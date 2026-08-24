// Package fixedincomeposition modela a posição consolidada de um usuário
// num título de renda fixa — decisão confirmada com o usuário (backlog
// 3.13, não estava em nenhum dos três documentos de referência): comprar o
// mesmo título mais de uma vez, em taxas diferentes, resulta numa única
// posição na carteira com a taxa contratada ajustada pela média ponderada
// pelo valor aportado em cada compra — mesmo comportamento do Tesouro
// Direto real (o usuário descreveu o próprio exemplo: comprar Tesouro
// IPCA+ 2032 a 7%, comprar de novo depois a 8,4%, a carteira mostra um
// título só com a taxa ajustada).
//
// Diferente de internal/domain/position (renda variável): lá ApplyBuy só
// pondera o preço médio pela quantidade (sempre inteira, sem taxa
// contratada — ação não tem "taxa"). Aqui a compra é por valor em R$, não
// por quantidade de títulos, então Quantity é fracionária (unidades
// nocionais de valor de face, ApplyBuy do valor investido / preço da
// unidade — tarefa fixedincomeexecution.Purchase) e existe uma terceira
// grandeza, AverageRate, sem equivalente na renda variável.
package fixedincomeposition

// Position é a posição de um usuário num único título de renda fixa,
// agregando todas as compras já feitas dele.
type Position struct {
	Quantity     float64
	AveragePrice float64
	AverageRate  float64
}

// ApplyBuy incorpora uma nova compra (quantity unidades nocionais, pagas a
// price cada, contratadas à taxa rate) à posição já existente — quantity e
// average_price são ponderados pelo custo total de cada lote (mesma
// convenção de position.ApplyBuy); average_rate é ponderado pelo valor
// investido em cada compra (quantity × price), que é exatamente o mesmo
// peso usado pro preço — um aporte maior pesa mais na taxa final, um
// aporte pequeno quase não move o blend.
func ApplyBuy(current Position, quantity, price, rate float64) Position {
	existingAmount := current.AveragePrice * current.Quantity
	newAmount := price * quantity
	totalAmount := existingAmount + newAmount
	newQuantity := current.Quantity + quantity

	newAverageRate := rate
	if totalAmount > 0 {
		newAverageRate = (current.AverageRate*existingAmount + rate*newAmount) / totalAmount
	}

	return Position{
		Quantity:     newQuantity,
		AveragePrice: totalAmount / newQuantity,
		AverageRate:  newAverageRate,
	}
}

// Record é uma Position enriquecida com a identificação do ativo (ticker,
// nome, tipo) pra leitura (GET /fixed-income/positions, tarefa 4.7) — mesma
// convenção de position.Record (campos crus, sem importar catalog).
// IsSandbox (tarefa 4.11, RF12) — mesmo raciocínio de position.Record.
type Record struct {
	AssetID     string
	AssetTicker string
	AssetName   string
	AssetType   string
	IsSandbox   bool
	Position
}
