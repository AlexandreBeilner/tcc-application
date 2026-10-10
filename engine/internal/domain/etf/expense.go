package etf

import (
	"math"
	"sort"

	"tcc-investimentos/engine/internal/domain/orderbook"
)

// Parâmetros da taxa de administração (tarefa R.9), valores ilustrativos:
// ExpenseDaysPerYear é a base de dias para ratear a taxa anual (um dia simulado
// vale um dia real); RaiseCashSlackPct é a folga sobre o caixa que o fundo levanta
// vendendo constituintes, pra o deslize de preço não deixar o pagamento curto.
const (
	ExpenseDaysPerYear = 365.0
	RaiseCashSlackPct  = 0.02
)

// DividendsPayable é o passivo de proventos ainda não pagos (Liabilities já soma
// a taxa a pagar, que também reduz o NAV).
func (f FundSnapshot) DividendsPayable() float64 { return f.Liabilities - f.FeesPayable }

// DailyExpense é a taxa de administração de um dia: expenseRatioPct ao ano sobre o
// patrimônio líquido do fundo, rateada por dia. Patrimônio ou taxa não positivos
// devolvem 0.
func DailyExpense(netAssets, expenseRatioPct float64) float64 {
	if netAssets <= 0 || expenseRatioPct <= 0 {
		return 0
	}
	return netAssets * expenseRatioPct / 100 / ExpenseDaysPerYear
}

// ExpensePayment é quanto da taxa acumulada o fundo quita agora: o menor entre a
// taxa a pagar e o caixa livre (caixa menos o passivo de proventos, que já é dos
// cotistas), em centavos para baixo; nunca deixa o caixa negativo. O que não
// couber segue acumulado.
func ExpensePayment(cash, dividendsPayable, feesPayable float64) float64 {
	free := cash - dividendsPayable
	if free <= 0 || feesPayable <= 0 {
		return 0
	}
	return math.Floor(math.Min(free, feesPayable)*100+1e-9) / 100
}

// CashShortfall é quanto falta de caixa livre para quitar a taxa acumulada (mais o
// que ainda vai acumular hoje); 0 quando o caixa cobre.
func CashShortfall(cash, dividendsPayable, feesPayable float64) float64 {
	return math.Max(feesPayable-math.Max(cash-dividendsPayable, 0), 0)
}

// RaiseCashOrders devolve as vendas, proporcionais ao valor de cada constituinte,
// que levantam amount de caixa (com folga de RaiseCashSlackPct), nunca acima do que
// o fundo detém; ordenadas por AssetID. Usa o caminho de venda a mercado do fundo
// (mesma forma de RebalanceOrder).
func RaiseCashOrders(f FundSnapshot, prices map[string]float64, amount float64) ([]RebalanceOrder, error) {
	if amount <= 0 || len(f.Holdings) == 0 {
		return nil, nil
	}
	var total float64
	for _, h := range f.Holdings {
		price, ok := prices[h.AssetID]
		if !ok || price <= 0 {
			return nil, ErrMissingConstituentPrice
		}
		total += float64(h.Quantity) * price
	}
	if total <= 0 {
		return nil, nil
	}
	fraction := math.Min(amount*(1+RaiseCashSlackPct)/total, 1)
	var orders []RebalanceOrder
	for _, h := range f.Holdings {
		quantity := int64(math.Ceil(float64(h.Quantity) * fraction))
		if quantity > h.Quantity {
			quantity = h.Quantity
		}
		if quantity > 0 {
			orders = append(orders, RebalanceOrder{
				AssetID: h.AssetID, Side: orderbook.SideSell, Type: orderbook.TypeMarket,
				Price: prices[h.AssetID], Quantity: quantity,
			})
		}
	}
	sort.Slice(orders, func(i, j int) bool { return orders[i].AssetID < orders[j].AssetID })
	return orders, nil
}
