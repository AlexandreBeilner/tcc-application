package tick

import (
	"context"
	"log"

	"tcc-investimentos/engine/internal/domain/bot"
	"tcc-investimentos/engine/internal/domain/coverage"
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
	// ListMarketMakingCandidates (R.4) devolve os ETFs com cotas que ainda
	// precisam de Market Maker ou de entrega do inventário do participante.
	ListMarketMakingCandidates(ctx context.Context) ([]etf.MarketMakingCandidate, error)
	// MarkRebalanced grava o dia do último rebalanceamento do fundo (R.7).
	MarkRebalanced(ctx context.Context, etfAssetID string, day int) error
	// LatestIndexValues devolve o último índice teórico gravado de cada ETF (R.7).
	LatestIndexValues(ctx context.Context) (map[string]float64, error)
	// ListShareHolders devolve, por ETF, as cotas que cada conta detém (R.8): o
	// snapshot de elegibilidade de um provento de ETF na data-ex.
	ListShareHolders(ctx context.Context, etfAssetIDs []string) (map[string][]PositionHolder, error)
}

// ETFCoverage garante a cobertura de Market Maker de um ativo (R.4);
// implementado por *coverage.Ensurer.
type ETFCoverage interface {
	EnsureCoverage(ctx context.Context, in coverage.Input) (coverage.Result, error)
}

// ETFParticipant é o que o tick precisa fora do caminho de ordens: provisionar
// caixa de uma conta de bot (evento imutável) e ler o que o Participante
// Autorizado detém depois de comprar.
type ETFParticipant interface {
	ProvisionCash(ctx context.Context, accountID string, amount float64) error
	ParticipantHoldings(ctx context.Context, assetIDs []string) (map[string]int64, error)
	// ParticipantCash (R.6) devolve o caixa do Participante Autorizado, pra
	// provisionar só o que falta antes de comprar a cesta ou as cotas.
	ParticipantCash(ctx context.Context) (float64, error)
}

// ETFDeps agrupa os colaboradores do motor de ETF (tarefa R.3/R.4).
type ETFDeps struct {
	Funds       ETFFunds
	Participant ETFParticipant
	Exchanger   etf.ShareExchanger
	Transferer  etf.ShareTransferer
	Coverage    ETFCoverage
}

// WithETF liga o Service ao motor de ETF: emissão inicial pelo Participante
// Autorizado, NAV diário (R.3) e cobertura de Market Maker (R.4). Sem esta
// chamada o tick não emite, não calcula NAV nem cobre ETF, comportamento anterior
// à Fase R (e o dos testes que não a exercitam).
func (s *Service) WithETF(deps ETFDeps) *Service {
	s.etf = deps
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
	if s.etf.Funds == nil {
		return nil
	}
	pending, err := s.etf.Funds.ListPendingIssuances(ctx)
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

	if err := s.etf.Participant.ProvisionCash(ctx, etf.AuthorizedParticipantAccountID, etf.InitialFundValue*etf.ParticipantCashMargin); err != nil {
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
	held, err := s.etf.Participant.ParticipantHoldings(ctx, ids)
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
	if err := s.etf.Exchanger.Create(ctx, etf.ShareExchange{
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
// próprio ETF (etfPrices); previousPrices (fechamento do dia anterior) faz o índice
// teórico avançar um dia (R.7). ETF sem preço de fechamento ou com constituinte sem
// preço fica de fora do dia. No dia de relatório (reportDay), cada fundo com caixa
// livre também gera o provento aos cotistas (R.8, etfDividends), pago em
// paymentDay; o passivo dele já entra no NAV do dia, então o NAV cai na data-ex.
func (s *Service) closingETFNAVs(ctx context.Context, constituentPrices, etfPrices, previousPrices map[string]float64, reportDay bool, paymentDay int) ([]ETFNAVEntry, []DividendRecord, error) {
	if s.etf.Funds == nil {
		return nil, nil, nil
	}
	funds, err := s.etf.Funds.ListFunds(ctx)
	if err != nil {
		return nil, nil, err
	}
	indexes, err := s.etf.Funds.LatestIndexValues(ctx)
	if err != nil {
		return nil, nil, err
	}

	// Taxa de administração (R.9): no dia de relatório o fundo quita do caixa livre o
	// que acumulou; todo dia acumula a taxa do dia (passivo, reduz o NAV). Os dois
	// entram no estado do fundo antes do provento e do NAV do dia.
	type dayFund struct {
		fund    etf.FundSnapshot
		paid    float64
		accrued float64
	}
	var eligible []dayFund
	adjusted := make([]etf.FundSnapshot, 0, len(funds))
	for _, f := range funds {
		if _, ok := etfPrices[f.ETFAssetID]; !ok {
			continue
		}
		navBefore, err := etf.NAVFromSnapshot(f, constituentPrices)
		if err != nil {
			log.Printf("NAV do ETF %s fora do dia: %v", f.ETFAssetID, err)
			continue
		}
		day := dayFund{fund: f}
		if reportDay {
			day.paid = etf.ExpensePayment(f.Cash, f.DividendsPayable(), f.FeesPayable)
			day.fund.Cash -= day.paid
			day.fund.FeesPayable -= day.paid
			day.fund.Liabilities -= day.paid
		}
		day.accrued = etf.DailyExpense(navBefore*float64(f.Shares), f.ExpenseRatioPct)
		day.fund.FeesPayable += day.accrued
		day.fund.Liabilities += day.accrued
		eligible = append(eligible, day)
		adjusted = append(adjusted, day.fund)
	}

	var dividends []DividendRecord
	if reportDay {
		if dividends, err = s.etfDividends(ctx, adjusted, paymentDay); err != nil {
			return nil, nil, err
		}
	}
	newLiability := make(map[string]float64, len(dividends))
	for _, d := range dividends {
		newLiability[d.AssetID] = d.FundLiability
	}
	entries := make([]ETFNAVEntry, 0, len(eligible))
	for _, day := range eligible {
		f := day.fund
		withDividend := f
		withDividend.Liabilities += newLiability[f.ETFAssetID]
		nav, err := etf.NAVFromSnapshot(withDividend, constituentPrices)
		if err != nil {
			continue
		}
		closePrice := etfPrices[f.ETFAssetID]
		index := etf.TheoreticalIndex(indexes[f.ETFAssetID], nav, f.Targets, previousPrices, constituentPrices)
		entries = append(entries, ETFNAVEntry{
			ETFAssetID: f.ETFAssetID, NAV: nav, ClosePrice: closePrice, PremiumPct: etf.PremiumPct(closePrice, nav),
			IndexValue: index, TrackingErrorPct: etf.TrackingErrorPct(nav, index),
			ExpenseAccrued: day.accrued, ExpensePaid: day.paid,
		})
	}
	return entries, dividends, nil
}

// etfDividends gera o provento de cada ETF com caixa livre (R.8): o fundo é
// detentor dos constituintes e recebe os proventos deles no próprio caixa; no dia de
// relatório distribui esse caixa (menos o que já deve de proventos anteriores) aos
// cotistas na data-ex, em lote, como qualquer provento (mesmo snapshot de
// elegibilidade e pagamento defasado). O total vira passivo do fundo (FundLiability)
// e só sai do caixa no pagamento, então o dinheiro nunca é criado nem destruído.
func (s *Service) etfDividends(ctx context.Context, funds []etf.FundSnapshot, paymentDay int) ([]DividendRecord, error) {
	type candidate struct {
		fund     etf.FundSnapshot
		perShare float64
	}
	var candidates []candidate
	var ids []string
	for _, f := range funds {
		if perShare := etf.DistributionPerShare(f.Cash, f.Liabilities, f.Shares); perShare > 0 {
			candidates = append(candidates, candidate{f, perShare})
			ids = append(ids, f.ETFAssetID)
		}
	}
	if len(candidates) == 0 {
		return nil, nil
	}
	holders, err := s.etf.Funds.ListShareHolders(ctx, ids)
	if err != nil {
		return nil, err
	}
	records := make([]DividendRecord, 0, len(candidates))
	for _, c := range candidates {
		recipients := holders[c.fund.ETFAssetID]
		var held int64
		for _, h := range recipients {
			held += int64(h.Quantity)
		}
		total := etf.DistributionTotal(c.perShare, held)
		if held <= 0 || total > c.fund.Cash-c.fund.Liabilities {
			continue
		}
		records = append(records, DividendRecord{
			AssetID: c.fund.ETFAssetID, ValuePerShare: c.perShare, PaymentDay: paymentDay,
			Recipients: recipients, FundLiability: total,
		})
	}
	return records, nil
}

// coverETFs dá liquidez aos ETFs com cotas emitidas (tarefa R.4), antes das
// rodadas do dia (o Market Maker precisa estar no roster com a cobertura já
// gravada): garante um Market Maker cobrindo (mesma regra de atribuição de Ação e
// FII, teto de ativos por Market Maker) e entrega a ele as cotas que o
// Participante Autorizado ainda detém, com o caixa que um Market Maker recebe
// (bot.InitialCash). É assim que "a cota nasce da criação" e chega ao book. ETF
// fora do universo negociável do dia (acabou de ser emitido) fica pro próximo
// tick. Idempotente: sem candidato, só a leitura de ListMarketMakingCandidates.
func (s *Service) coverETFs(ctx context.Context, equities map[string]*equityRoundState) error {
	if s.etf.Funds == nil || s.etf.Coverage == nil {
		return nil
	}
	candidates, err := s.etf.Funds.ListMarketMakingCandidates(ctx)
	if err != nil {
		return err
	}
	for _, c := range candidates {
		state, ok := equities[c.ETFAssetID]
		if !ok {
			continue
		}
		result, err := s.etf.Coverage.EnsureCoverage(ctx, coverage.Input{
			AssetID:           c.ETFAssetID,
			OutstandingShares: c.Shares,
			Price:             state.Price,
		})
		if err != nil {
			return err
		}
		held, err := s.etf.Participant.ParticipantHoldings(ctx, []string{c.ETFAssetID})
		if err != nil {
			return err
		}
		quantity := held[c.ETFAssetID]
		if quantity <= 0 {
			continue
		}
		if err := s.etf.Transferer.Transfer(ctx, etf.ShareTransfer{
			ETFAssetID:    c.ETFAssetID,
			FromAccountID: etf.AuthorizedParticipantAccountID,
			ToAccountID:   result.MarketMakerID,
			Quantity:      quantity,
			Price:         state.Price,
		}); err != nil {
			return err
		}
		if err := s.etf.Participant.ProvisionCash(ctx, result.MarketMakerID, bot.InitialCash(float64(quantity)*state.Price, 0, true)); err != nil {
			return err
		}
	}
	return nil
}

// loadETFFunds lê, numa leitura em lote por tick, o estado dos fundos de ETF
// com cotas (R.5) pra o iNAV em memória; sem WithETF devolve nil.
func (s *Service) loadETFFunds(ctx context.Context) (map[string]etf.FundSnapshot, error) {
	if s.etf.Funds == nil {
		return nil, nil
	}
	funds, err := s.etf.Funds.ListFunds(ctx)
	if err != nil {
		return nil, err
	}
	byID := make(map[string]etf.FundSnapshot, len(funds))
	for _, f := range funds {
		byID[f.ETFAssetID] = f
	}
	return byID, nil
}
