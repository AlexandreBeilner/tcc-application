package tick

import (
	"context"
	"log"
	"sort"

	"tcc-investimentos/engine/internal/domain/etf"
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
		cash := fund.Cash
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
