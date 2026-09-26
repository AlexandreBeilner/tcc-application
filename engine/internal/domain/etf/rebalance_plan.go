package etf

import (
	"errors"
	"math"
	"sort"

	"tcc-investimentos/engine/internal/domain/orderbook"
)

// Parâmetros do rebalanceamento do fundo (tarefa R.7): valores ilustrativos,
// mesma calibração fina da tarefa 8.1. RebalanceDriftLimitPct é a deriva máxima
// (em pontos percentuais) de um peso real contra o peso-alvo antes de forçar um
// rebalanceamento fora do calendário; RebalanceMinOrderPct é o valor mínimo de
// uma ordem (fração do patrimônio do fundo): abaixo disso a ordem é só ruído de
// arredondamento e o fundo a deixa de fora, pra não pagar spread por um lote de
// poucas unidades; RebalanceBuySlackPct é a folga de preço sobre a cotação de
// referência usada pra limitar a compra ao caixa que a venda gerou.
const (
	RebalanceDriftLimitPct = 5.0
	RebalanceMinOrderPct   = 0.005
	RebalanceBuySlackPct   = 0.02
)

// ErrNoTargets é devolvido quando o fundo não tem composição-alvo real.
var ErrNoTargets = errors.New("fundo sem composição-alvo de constituintes reais")

// TargetWeight é o peso-alvo de um constituinte real da cesta do fundo.
type TargetWeight struct {
	AssetID   string
	WeightPct float64
}

// RebalanceDue diz se o calendário pede um rebalanceamento hoje: o fundo nunca
// foi rebalanceado (lastDay nil) ou já se passaram everyDays dias. everyDays não
// positivo desliga o gatilho de calendário.
func RebalanceDue(dayIndex int, lastDay *int, everyDays int) bool {
	if everyDays <= 0 {
		return false
	}
	return lastDay == nil || dayIndex-*lastDay >= everyDays
}

// normalizedTargets devolve os alvos com pesos reescalados para somar 100 (a
// cesta pode ter constituinte cosmético sem asset_id, que fica de fora), na
// ordem por AssetID.
func normalizedTargets(targets []TargetWeight) ([]TargetWeight, error) {
	var total float64
	for _, t := range targets {
		if t.AssetID == "" || t.WeightPct <= 0 {
			return nil, ErrInvalidWeightedConstituent
		}
		total += t.WeightPct
	}
	if len(targets) == 0 || total <= 0 {
		return nil, ErrNoTargets
	}
	out := make([]TargetWeight, len(targets))
	for i, t := range targets {
		out[i] = TargetWeight{AssetID: t.AssetID, WeightPct: t.WeightPct / total * 100}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].AssetID < out[j].AssetID })
	return out, nil
}

// reconciliation monta as linhas de RebalanceOrders: a união dos constituintes
// que o fundo detém e dos alvos (quem sai da cesta tem peso-alvo 0).
func reconciliation(f FundSnapshot, targets []TargetWeight, prices map[string]float64) ([]RebalanceConstituent, error) {
	byAsset := map[string]*RebalanceConstituent{}
	var ids []string
	get := func(id string) (*RebalanceConstituent, error) {
		if c, ok := byAsset[id]; ok {
			return c, nil
		}
		price, ok := prices[id]
		if !ok {
			return nil, ErrMissingConstituentPrice
		}
		c := &RebalanceConstituent{AssetID: id, Price: price}
		byAsset[id] = c
		ids = append(ids, id)
		return c, nil
	}
	for _, h := range f.Holdings {
		c, err := get(h.AssetID)
		if err != nil {
			return nil, err
		}
		c.CurrentQuantity = h.Quantity
	}
	for _, t := range targets {
		c, err := get(t.AssetID)
		if err != nil {
			return nil, err
		}
		c.TargetWeightPct = t.WeightPct
	}
	sort.Strings(ids)
	rows := make([]RebalanceConstituent, len(ids))
	for i, id := range ids {
		rows[i] = *byAsset[id]
	}
	return rows, nil
}

// WeightDriftPct devolve a maior deriva, em pontos percentuais, entre o peso real
// de um constituinte (sobre o patrimônio líquido do fundo) e o peso-alvo.
func WeightDriftPct(f FundSnapshot, targets []TargetWeight, prices map[string]float64) (float64, error) {
	targets, err := normalizedTargets(targets)
	if err != nil {
		return 0, err
	}
	rows, err := reconciliation(f, targets, prices)
	if err != nil {
		return 0, err
	}
	net := f.Cash - f.Liabilities
	for _, c := range rows {
		net += float64(c.CurrentQuantity) * c.Price
	}
	if net <= 0 {
		return 0, nil
	}
	var drift float64
	for _, c := range rows {
		actual := float64(c.CurrentQuantity) * c.Price / net * 100
		drift = math.Max(drift, math.Abs(actual-c.TargetWeightPct))
	}
	return drift, nil
}

// PlanRebalance devolve as ordens que levam a cesta real do fundo ao peso-alvo
// (RebalanceOrders, H.2), sem as de valor abaixo de RebalanceMinOrderPct do
// patrimônio, com as vendas antes das compras (o fundo financia as compras com o
// que vende, então nunca fica com caixa negativo); dentro de cada lado, por
// AssetID (determinismo).
func PlanRebalance(f FundSnapshot, targets []TargetWeight, prices map[string]float64) ([]RebalanceOrder, error) {
	targets, err := normalizedTargets(targets)
	if err != nil {
		return nil, err
	}
	rows, err := reconciliation(f, targets, prices)
	if err != nil {
		return nil, err
	}
	orders, err := RebalanceOrders(rows, math.Max(f.Cash, 0), math.Max(f.Liabilities, 0))
	if err != nil {
		return nil, err
	}
	net := f.Cash - f.Liabilities
	for _, c := range rows {
		net += float64(c.CurrentQuantity) * c.Price
	}
	kept := orders[:0]
	for _, o := range orders {
		if float64(o.Quantity)*o.Price >= RebalanceMinOrderPct*net {
			kept = append(kept, o)
		}
	}
	sort.SliceStable(kept, func(i, j int) bool {
		if kept[i].Side != kept[j].Side {
			return kept[i].Side == orderbook.SideSell
		}
		return kept[i].AssetID < kept[j].AssetID
	})
	return kept, nil
}

// AffordableBuyQuantity limita a compra ao caixa disponível, com folga de preço
// (RebalanceBuySlackPct) pra o deslize ao varrer o book.
func AffordableBuyQuantity(wanted int64, price, cash float64) int64 {
	if wanted <= 0 || price <= 0 || cash <= 0 {
		return 0
	}
	fit := int64(math.Floor(cash / (price * (1 + RebalanceBuySlackPct))))
	if fit < wanted {
		return fit
	}
	return wanted
}

// TheoreticalIndex avança o índice teórico do fundo um dia: pesos-alvo constantes,
// sem atrito nem caixa (retorno diário = média dos retornos dos constituintes
// ponderada pelos pesos-alvo). Constituinte sem preço anterior ou atual válido
// entra com retorno zero. previous não positivo (primeiro dia) devolve base.
func TheoreticalIndex(previous, base float64, targets []TargetWeight, previousPrices, prices map[string]float64) float64 {
	if previous <= 0 {
		return base
	}
	normalized, err := normalizedTargets(targets)
	if err != nil {
		return previous
	}
	var ret float64
	for _, t := range normalized {
		p0, p1 := previousPrices[t.AssetID], prices[t.AssetID]
		if p0 > 0 && p1 > 0 {
			ret += t.WeightPct / 100 * (p1/p0 - 1)
		}
	}
	return previous * (1 + ret)
}

// TrackingErrorPct é o desvio acumulado do NAV do fundo contra o índice teórico,
// em pontos percentuais (positivo: o fundo está à frente do índice).
func TrackingErrorPct(nav, index float64) float64 {
	if index <= 0 {
		return 0
	}
	return (nav/index - 1) * 100
}
