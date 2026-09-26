package tick

import (
	"context"
	"log"

	"tcc-investimentos/engine/internal/domain/etf"
	"tcc-investimentos/engine/internal/domain/orderbook"
	"tcc-investimentos/engine/internal/domain/orderexecution"
)

// ETFFunds lê o estado dos fundos de ETF (tarefa R.3): quais ETFs ainda esperam
// a emissão inicial e o estado (cotas, caixa, passivo, posições) dos que já
// têm cotas. Implementado por *db.ETFFundRepository.
type ETFFunds interface {
	ListPendingIssuances(ctx context.Context) ([]etf.PendingIssuance, error)
	ListFunds(ctx context.Context) ([]etf.FundSnapshot, error)
}

// ETFParticipant é a parte do Participante Autorizado que o tick precisa fora
// do caminho de ordens: provisionar caixa (evento imutável) e ler o que ele
// detém dos constituintes depois de comprar.
type ETFParticipant interface {
	ProvisionParticipantCash(ctx context.Context, amount float64) error
	ParticipantHoldings(ctx context.Context, assetIDs []string) (map[string]int64, error)
}

// WithETF liga o Service ao motor de ETF (tarefa R.3): emissão inicial pelo
// Participante Autorizado e NAV diário. Sem esta chamada o tick não emite nem
// calcula NAV, comportamento anterior à Fase R (e o dos testes que não a
// exercitam).
func (s *Service) WithETF(funds ETFFunds, participant ETFParticipant, exchanger etf.ShareExchanger) *Service {
	s.etfFunds, s.etfParticipant, s.etfExchanger = funds, participant, exchanger
	return s
}

// issueETFs faz a emissão inicial de cada ETF pendente (R.3), depois das rodadas
// do dia, quando os Market Makers já cotaram os constituintes: o Participante
// Autorizado é provisionado de caixa, compra a cesta a mercado nos books (mesma
// pipeline de ordens de qualquer conta) e cria as cotas que a cesta de fato
// comprada sustenta (etf.InitialIssuance), entregando-a ao fundo. Uma falha de
// negócio num ETF (constituinte sem liquidez, sem preço) só o adia pro próximo
// tick, nunca aborta o tick; o que o participante comprou a mais fica com ele.
func (s *Service) issueETFs(ctx context.Context, run *roundRun) error {
	if s.etfFunds == nil {
		return nil
	}
	pending, err := s.etfFunds.ListPendingIssuances(ctx)
	if err != nil {
		return err
	}
	for _, p := range pending {
		if err := s.issueETF(ctx, run, p); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) issueETF(ctx context.Context, run *roundRun, p etf.PendingIssuance) error {
	constituents := make([]etf.WeightedConstituent, 0, len(p.Holdings))
	for _, h := range p.Holdings {
		state, ok := run.equities[*h.AssetID]
		if !ok {
			log.Printf("emissão do ETF %s adiada: constituinte %s fora do universo negociável", p.ETFAssetID, *h.AssetID)
			return nil
		}
		constituents = append(constituents, etf.WeightedConstituent{AssetID: *h.AssetID, WeightPct: h.WeightPct, Price: state.Price})
	}
	target, err := etf.InitialTargetBasket(constituents, etf.InitialFundValue)
	if err != nil {
		log.Printf("emissão do ETF %s adiada: %v", p.ETFAssetID, err)
		return nil
	}

	if err := s.etfParticipant.ProvisionParticipantCash(ctx, etf.InitialFundValue*etf.ParticipantCashMargin); err != nil {
		return err
	}
	for _, leg := range target {
		outcome, err := s.orderSubmitter.Submit(ctx, orderexecution.Request{
			UserID:   etf.AuthorizedParticipantAccountID,
			AssetID:  leg.AssetID,
			Side:     orderbook.SideBuy,
			Type:     orderbook.TypeMarket,
			Quantity: int(leg.Quantity),
		})
		if err != nil {
			if businessRejection(err) {
				continue
			}
			return err
		}
		run.fillsExecuted += len(outcome.Fills)
		run.volumeByAssetID[leg.AssetID] += outcome.FilledQuantity
		if len(outcome.Fills) > 0 {
			run.equities[leg.AssetID].Price = outcome.Fills[len(outcome.Fills)-1].Price
		}
	}

	ids := make([]string, 0, len(constituents))
	for _, c := range constituents {
		ids = append(ids, c.AssetID)
	}
	held, err := s.etfParticipant.ParticipantHoldings(ctx, ids)
	if err != nil {
		return err
	}
	// Preço de referência das pernas: o último preço de cada constituinte depois
	// das compras.
	for i := range constituents {
		constituents[i].Price = run.equities[constituents[i].AssetID].Price
	}
	shares, basket, err := etf.InitialIssuance(constituents, held)
	if err != nil {
		log.Printf("emissão do ETF %s adiada: %v", p.ETFAssetID, err)
		return nil
	}
	if err := s.etfExchanger.Create(ctx, etf.ShareExchange{
		ETFAssetID:           p.ETFAssetID,
		FundAccountID:        p.FundAccountID,
		ParticipantAccountID: etf.AuthorizedParticipantAccountID,
		Shares:               shares,
		SharePrice:           etf.InitialSharePrice,
		Basket:               basket,
	}); err != nil {
		log.Printf("emissão do ETF %s falhou: %v", p.ETFAssetID, err)
		return nil
	}
	log.Printf("ETF %s emitido: %d cotas, cesta de %d constituintes", p.ETFAssetID, shares, len(basket))
	return nil
}

// closingETFNAVs calcula o NAV de fechamento de cada ETF com cotas emitidas a
// partir das posições do fundo (uma leitura em lote) e dos preços de fechamento
// dos constituintes; o ágio/deságio compara com o preço de fechamento do
// próprio ETF (etfPrices). ETF sem preço de fechamento ou com constituinte sem
// preço fica de fora do dia.
func (s *Service) closingETFNAVs(ctx context.Context, constituentPrices, etfPrices map[string]float64) ([]ETFNAVEntry, error) {
	if s.etfFunds == nil {
		return nil, nil
	}
	funds, err := s.etfFunds.ListFunds(ctx)
	if err != nil {
		return nil, err
	}
	entries := make([]ETFNAVEntry, 0, len(funds))
	for _, f := range funds {
		nav, err := etf.NAVFromSnapshot(f, constituentPrices)
		if err != nil {
			log.Printf("NAV do ETF %s fora do dia: %v", f.ETFAssetID, err)
			continue
		}
		closePrice, ok := etfPrices[f.ETFAssetID]
		if !ok {
			continue
		}
		entries = append(entries, ETFNAVEntry{ETFAssetID: f.ETFAssetID, NAV: nav, ClosePrice: closePrice, PremiumPct: etf.PremiumPct(closePrice, nav)})
	}
	return entries, nil
}
