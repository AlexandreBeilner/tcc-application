package etf

import "math"

// DistributionPerShare é o provento por cota que o fundo distribui aos cotistas
// (tarefa R.8): o caixa livre (caixa menos o que já deve de proventos anteriores)
// dividido pelas cotas, arredondado para baixo em centavos (dividend_events guarda
// centavos, e o arredondamento pra baixo nunca distribui mais do que o fundo tem).
// Sem cotas ou sem caixa livre, 0.
func DistributionPerShare(cash, liabilities float64, shares int64) float64 {
	free := cash - liabilities
	if shares <= 0 || free <= 0 {
		return 0
	}
	return math.Floor(free/float64(shares)*100+1e-9) / 100
}

// DistributionTotal é o valor total pago por um provento de valuePerShare a quem
// detém held cotas, em centavos exatos: é o que sai do caixa do fundo, entra como
// passivo na data-ex e é creditado aos cotistas.
func DistributionTotal(valuePerShare float64, held int64) float64 {
	return math.Round(valuePerShare*float64(held)*100) / 100
}
