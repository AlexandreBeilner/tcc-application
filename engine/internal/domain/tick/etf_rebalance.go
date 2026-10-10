package tick

import (
	"context"
	"log"
	"sort"

	"tcc-investimentos/engine/internal/domain/etf"
	"tcc-investimentos/engine/internal/domain/fundamentals"
	"tcc-investimentos/engine/internal/domain/orderbook"
)

// rebalanceETFs é o rebalanceamento mecânico dos fundos (tarefa R.7), no fim do
// dia, depois da última rodada e da passada final de cotação (o análogo do leilão
// de fechamento). Um fundo rebalanceia quando o calendário pede
// (rebalance_frequency_days) ou quando algum peso real deriva do alvo além de
// etf.RebalanceDriftLimitPct; fora disso não faz nenhum comando. As ordens saem
// pela conta do fundo, a mercado, com as vendas antes das compras, e a compra é
// limitada ao caixa que a venda gerou, então o fundo nunca fica com caixa
// negativo. Devolve se algum fundo negociou (o estado em memória dos fundos deve
// ser relido). Falha de negócio só encerra aquele fundo no dia.
func (s *Service) rebalanceETFs(ctx context.Context, run *roundRun) (bool, error) {
	if s.etf.Funds == nil || len(run.etfFunds) == 0 {
		return false, nil
	}
	ids := make([]string, 0, len(run.etfFunds))
	for id := range run.etfFunds {
		ids = append(ids, id)
	}
	sort.Strings(ids)

	traded := false
	for _, id := range ids {
		fund := run.etfFunds[id]
		fund.Cash, fund.Liabilities = 0, 0
		prices, ok := rebalancePrices(fund, run)
		if !ok {
			continue
		}
		due := etf.RebalanceDue(run.dayIndex, fund.LastRebalanceDay, fund.RebalanceEveryDays)
		if !due {
			drift, err := etf.WeightDriftPct(fund, fund.Targets, prices)
			if err != nil || drift <= etf.RebalanceDriftLimitPct {
				continue
			}
		}
		orders, err := etf.PlanRebalance(fund, fund.Targets, prices)
		if err != nil {
			log.Printf("rebalanceamento do ETF %s adiado: %v", id, err)
			continue
		}
		// O caixa do fundo é dividendo dos constituintes esperando distribuição aos
		// cotistas (R.8), então o rebalanceamento não o toca: os pesos saem só das
		// posições e a compra usa apenas o que as vendas do próprio rebalanceamento geram.
		cash := 0.0
		for _, o := range orders {
			quantity := o.Quantity
			if o.Side == orderbook.SideBuy {
				quantity = etf.AffordableBuyQuantity(o.Quantity, run.equities[o.AssetID].Price, cash)
				if quantity <= 0 {
					continue
				}
			}
			outcome, err := s.submitMarket(ctx, run, fund.FundAccountID, o.Side, o.AssetID, quantity)
			if err != nil {
				return traded, err
			}
			for _, f := range outcome.Fills {
				value := f.Price * float64(f.Quantity)
				if o.Side == orderbook.SideBuy {
					cash -= value
				} else {
					cash += value
				}
			}
			traded = traded || outcome.FilledQuantity > 0
		}
		if err := s.etf.Funds.MarkRebalanced(ctx, id, run.dayIndex); err != nil {
			return traded, err
		}
		log.Printf("ETF %s rebalanceado no dia %d: %d ordens", id, run.dayIndex, len(orders))
	}
	return traded, nil
}

// rebalancePrices devolve o preço corrente de cada constituinte que o fundo detém
// ou deve deter; false quando algum está fora do universo negociável.
func rebalancePrices(fund etf.FundSnapshot, run *roundRun) (map[string]float64, bool) {
	prices := make(map[string]float64, len(fund.Holdings)+len(fund.Targets))
	add := func(id string) bool {
		state, ok := run.equities[id]
		if !ok || state.Price <= 0 {
			return false
		}
		prices[id] = state.Price
		return true
	}
	for _, h := range fund.Holdings {
		if !add(h.AssetID) {
			return nil, false
		}
	}
	for _, t := range fund.Targets {
		if !add(t.AssetID) {
			return nil, false
		}
	}
	return prices, true
}

// raiseFundCash levanta o caixa que falta para o fundo quitar a taxa de administração
// (tarefa R.9): no dia de relatório, quando o caixa livre (caixa menos o passivo de
// proventos) não cobre a taxa acumulada, o fundo vende constituintes na proporção do
// valor de cada um (etf.RaiseCashOrders), a mercado, pela própria conta, e o
// pagamento do dia sai desse caixa. Fora do dia de relatório ou com caixa suficiente,
// não faz nenhum comando. Devolve se algum fundo negociou.
func (s *Service) raiseFundCash(ctx context.Context, run *roundRun) (bool, error) {
	if s.etf.Funds == nil || len(run.etfFunds) == 0 || !fundamentals.IsReportDay(run.dayIndex, fundamentals.DefaultReportFrequencyDays) {
		return false, nil
	}
	ids := make([]string, 0, len(run.etfFunds))
	for id := range run.etfFunds {
		ids = append(ids, id)
	}
	sort.Strings(ids)

	traded := false
	for _, id := range ids {
		fund := run.etfFunds[id]
		shortfall := etf.CashShortfall(fund.Cash, fund.DividendsPayable(), fund.FeesPayable)
		if shortfall <= 0 {
			continue
		}
		prices, ok := rebalancePrices(fund, run)
		if !ok {
			continue
		}
		orders, err := etf.RaiseCashOrders(fund, prices, shortfall)
		if err != nil {
			continue
		}
		for _, o := range orders {
			outcome, err := s.submitMarket(ctx, run, fund.FundAccountID, o.Side, o.AssetID, o.Quantity)
			if err != nil {
				return traded, err
			}
			traded = traded || outcome.FilledQuantity > 0
		}
		log.Printf("ETF %s vendeu constituintes para quitar a taxa de administração (faltavam %.2f de caixa)", id, shortfall)
	}
	return traded, nil
}
