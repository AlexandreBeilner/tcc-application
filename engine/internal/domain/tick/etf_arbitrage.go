package tick

import (
	"context"
	"log"
	"sort"

	"tcc-investimentos/engine/internal/domain/etf"
	"tcc-investimentos/engine/internal/domain/orderbook"
	"tcc-investimentos/engine/internal/domain/orderexecution"
)

// arbitrageETFs é o Participante Autorizado do tick (tarefa R.6): depois das
// rodadas do dia, compara o último preço de cada ETF com o iNAV (o mesmo que o
// Market Maker usa como âncora) e, só quando o desvio passa da faixa
// (etf.ArbitrageActionBandPct), cria ou resgata cotas para empurrar o preço de
// volta ao NAV. Sem desvio, não faz nenhum comando (só lê o que já está em
// memória); com desvio, o custo é o da cesta do lote, limitado a
// etf.ArbitrageDailyCapPct das cotas, então acompanha a atividade e não o tamanho
// do catálogo. Falha de negócio (sem liquidez, saldo, float) só encerra aquele
// ETF no dia; erro de infraestrutura aborta o tick, como no resto das rodadas.
func (s *Service) arbitrageETFs(ctx context.Context, run *roundRun) error {
	if s.etf.Funds == nil || s.etf.Exchanger == nil || len(run.etfFunds) == 0 {
		return nil
	}
	ids := make([]string, 0, len(run.etfFunds))
	for id := range run.etfFunds {
		ids = append(ids, id)
	}
	sort.Strings(ids)

	for _, id := range ids {
		state, ok := run.equities[id]
		if !ok {
			continue
		}
		inav := run.inav(id)
		if inav == nil {
			continue
		}
		direction, deviation := etf.ArbitrageSignal(state.Price, *inav)
		if direction == etf.ArbitrageNone {
			continue
		}
		fund := run.etfFunds[id]
		wanted := etf.ArbitrageShares(fund.Shares, deviation)
		legs, ok := fundLegs(fund, run)
		if wanted <= 0 || !ok {
			continue
		}
		var err error
		if direction == etf.ArbitrageCreate {
			err = s.arbitrageCreate(ctx, run, fund, legs, wanted, *inav)
		} else {
			err = s.arbitrageRedeem(ctx, run, fund, legs, wanted, *inav)
		}
		if err != nil {
			return err
		}
	}
	return nil
}

// fundLegs devolve o que o fundo detém de cada constituinte, com o preço
// corrente de rodada; false quando algum constituinte está fora do universo.
func fundLegs(fund etf.FundSnapshot, run *roundRun) ([]etf.BasketLeg, bool) {
	legs := make([]etf.BasketLeg, 0, len(fund.Holdings))
	for _, h := range fund.Holdings {
		state, ok := run.equities[h.AssetID]
		if !ok || state.Price <= 0 {
			return nil, false
		}
		legs = append(legs, etf.BasketLeg{AssetID: h.AssetID, Quantity: h.Quantity, Price: state.Price})
	}
	return legs, true
}

// arbitrageCreate trata o ágio: compra a cesta pro-rata do lote nos books dos
// constituintes (descontando o que o participante já detém), cria as cotas que a
// cesta de fato obtida sustenta (fill parcial reduz o lote, nunca cria pela
// metade) e vende as cotas a mercado, o que puxa o preço de volta ao NAV.
func (s *Service) arbitrageCreate(ctx context.Context, run *roundRun, fund etf.FundSnapshot, legs []etf.BasketLeg, wanted int64, inav float64) error {
	target, err := etf.ProRataBasket(legs, fund.Shares, wanted, true)
	if err != nil {
		return nil
	}
	ids := legAssetIDs(legs)
	held, err := s.etf.Participant.ParticipantHoldings(ctx, ids)
	if err != nil {
		return err
	}
	var cost float64
	for _, leg := range target {
		if deficit := leg.Quantity - held[leg.AssetID]; deficit > 0 {
			cost += float64(deficit) * leg.Price
		}
	}
	if err := s.ensureParticipantCash(ctx, cost*etf.ArbitrageCashMargin); err != nil {
		return err
	}
	for _, leg := range target {
		if deficit := leg.Quantity - held[leg.AssetID]; deficit > 0 {
			if _, err := s.participantOrder(ctx, run, orderbook.SideBuy, leg.AssetID, deficit); err != nil {
				return err
			}
		}
	}

	held, err = s.etf.Participant.ParticipantHoldings(ctx, ids)
	if err != nil {
		return err
	}
	shares := etf.SupportedShares(legs, fund.Shares, wanted, held)
	if shares <= 0 {
		log.Printf("arbitragem do ETF %s adiada: os books não sustentaram nenhuma cota", fund.ETFAssetID)
		return nil
	}
	basket, err := etf.ProRataBasket(legs, fund.Shares, shares, true)
	if err != nil {
		return nil
	}
	if err := s.etf.Exchanger.Create(ctx, etf.ShareExchange{
		ETFAssetID:           fund.ETFAssetID,
		FundAccountID:        fund.FundAccountID,
		ParticipantAccountID: etf.AuthorizedParticipantAccountID,
		Shares:               shares,
		SharePrice:           inav,
		Basket:               basket,
	}); err != nil {
		log.Printf("arbitragem do ETF %s: criação falhou: %v", fund.ETFAssetID, err)
		return nil
	}
	sold, err := s.participantOrder(ctx, run, orderbook.SideSell, fund.ETFAssetID, shares)
	if err != nil {
		return err
	}
	log.Printf("arbitragem do ETF %s: ágio, %d cotas criadas, %d vendidas", fund.ETFAssetID, shares, sold)
	return nil
}

// arbitrageRedeem trata o deságio: compra as cotas a mercado (o que sobe o preço
// de volta ao NAV), resgata as que de fato comprou pela cesta pro-rata (arredonda
// pra baixo, nunca leva mais que a fração devida) e vende a cesta nos books.
func (s *Service) arbitrageRedeem(ctx context.Context, run *roundRun, fund etf.FundSnapshot, legs []etf.BasketLeg, wanted int64, inav float64) error {
	price := run.equities[fund.ETFAssetID].Price
	if err := s.ensureParticipantCash(ctx, float64(wanted)*price*etf.ArbitrageCashMargin); err != nil {
		return err
	}
	if _, err := s.participantOrder(ctx, run, orderbook.SideBuy, fund.ETFAssetID, wanted); err != nil {
		return err
	}
	held, err := s.etf.Participant.ParticipantHoldings(ctx, []string{fund.ETFAssetID})
	if err != nil {
		return err
	}
	shares := held[fund.ETFAssetID]
	if shares > wanted {
		shares = wanted
	}
	if shares <= 0 {
		log.Printf("arbitragem do ETF %s adiada: o book não vendeu nenhuma cota", fund.ETFAssetID)
		return nil
	}
	basket, err := etf.ProRataBasket(legs, fund.Shares, shares, false)
	if err != nil {
		return nil
	}
	if err := s.etf.Exchanger.Redeem(ctx, etf.ShareExchange{
		ETFAssetID:           fund.ETFAssetID,
		FundAccountID:        fund.FundAccountID,
		ParticipantAccountID: etf.AuthorizedParticipantAccountID,
		Shares:               shares,
		SharePrice:           inav,
		Basket:               basket,
	}); err != nil {
		log.Printf("arbitragem do ETF %s: resgate falhou: %v", fund.ETFAssetID, err)
		return nil
	}
	for _, leg := range basket {
		if _, err := s.participantOrder(ctx, run, orderbook.SideSell, leg.AssetID, leg.Quantity); err != nil {
			return err
		}
	}
	log.Printf("arbitragem do ETF %s: deságio, %d cotas resgatadas", fund.ETFAssetID, shares)
	return nil
}

// participantOrder envia uma ordem a mercado do Participante Autorizado e devolve
// a quantidade preenchida (ver submitMarket).
func (s *Service) participantOrder(ctx context.Context, run *roundRun, side orderbook.Side, assetID string, quantity int64) (int, error) {
	outcome, err := s.submitMarket(ctx, run, etf.AuthorizedParticipantAccountID, side, assetID, quantity)
	return outcome.FilledQuantity, err
}

// submitMarket envia uma ordem a mercado de uma conta mecânica (Participante
// Autorizado ou fundo) pelo mesmo Submit de qualquer conta e reflete o resultado
// no estado da rodada (preço de referência, volume, fills). Rejeição de negócio
// devolve um Outcome vazio sem erro.
func (s *Service) submitMarket(ctx context.Context, run *roundRun, userID string, side orderbook.Side, assetID string, quantity int64) (orderexecution.Outcome, error) {
	outcome, err := s.orderSubmitter.Submit(ctx, orderexecution.Request{
		UserID:   userID,
		AssetID:  assetID,
		Side:     side,
		Type:     orderbook.TypeMarket,
		Quantity: int(quantity),
	})
	if err != nil {
		if businessRejection(err) {
			log.Printf("ordem mecânica de %s em %s rejeitada: %v", userID, assetID, err)
			return orderexecution.Outcome{}, nil
		}
		return orderexecution.Outcome{}, err
	}
	run.fillsExecuted += len(outcome.Fills)
	run.volumeByAssetID[assetID] += outcome.FilledQuantity
	if len(outcome.Fills) > 0 {
		run.equities[assetID].Price = outcome.Fills[len(outcome.Fills)-1].Price
	}
	return outcome, nil
}

// ensureParticipantCash provisiona (evento imutável) só o que falta ao caixa do
// participante para cobrir need, então o dinheiro criado acompanha o custo real
// das arbitragens e não cresce a cada tick.
func (s *Service) ensureParticipantCash(ctx context.Context, need float64) error {
	if need <= 0 {
		return nil
	}
	balance, err := s.etf.Participant.ParticipantCash(ctx)
	if err != nil {
		return err
	}
	if balance >= need {
		return nil
	}
	return s.etf.Participant.ProvisionCash(ctx, etf.AuthorizedParticipantAccountID, need-balance)
}

func legAssetIDs(legs []etf.BasketLeg) []string {
	ids := make([]string, len(legs))
	for i, l := range legs {
		ids[i] = l.AssetID
	}
	return ids
}
