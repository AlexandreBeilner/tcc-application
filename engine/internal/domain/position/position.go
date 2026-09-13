// Package position modela a posição consolidada de um usuário num ativo —
// quantidade em carteira e preço médio de aquisição (average_price), a
// métrica de custo usada pra apurar lucro/prejuízo realizado numa venda.
// Nasce da tarefa 3.12 (execução de ordens ponta a ponta): antes só existia
// a tabela `positions`, sem pacote de domínio que decidisse como
// recalcular average_price numa compra.
package position

import "errors"

// ErrInsufficientQuantity é devolvido por ApplySell quando a venda excede a
// quantidade em carteira — nunca deveria acontecer de fato, porque
// orderexecution.Execute já valida saldo/posição antes de chegar aqui; serve
// de guarda de invariante contra chamada incorreta, não de validação de
// borda de negócio (essa já aconteceu antes).
var ErrInsufficientQuantity = errors.New("quantidade em posição insuficiente para a venda")

// ErrFloatExceeded é devolvido por ValidateFloatCeiling quando a soma das
// posições de todos os detentores de um ativo ultrapassaria
// outstanding_shares — o float finito (tarefa A.3, proposta
// motor-mercado-realista 2.2).
var ErrFloatExceeded = errors.New("soma das posições excede outstanding_shares do ativo")

// Position é a posição de um usuário num único ativo.
type Position struct {
	Quantity     int
	AveragePrice float64
}

// ApplyBuy recalcula quantidade e preço médio depois de uma nova compra,
// pela média ponderada pelo custo total de cada lote (convenção padrão de
// contabilidade de posição) — nunca marca a mercado aqui, isso só acontece
// na consulta/exibição do portfólio, não na projeção da compra.
func ApplyBuy(current Position, quantity int, price float64) Position {
	totalCost := current.AveragePrice*float64(current.Quantity) + price*float64(quantity)
	newQuantity := current.Quantity + quantity
	return Position{Quantity: newQuantity, AveragePrice: totalCost / float64(newQuantity)}
}

// ApplySell reduz a quantidade depois de uma venda — average_price não muda
// numa venda, porque ele só reflete o custo do que ainda está em carteira,
// não o que já saiu.
func ApplySell(current Position, quantity int) (Position, error) {
	if quantity > current.Quantity {
		return Position{}, ErrInsufficientQuantity
	}
	return Position{Quantity: current.Quantity - quantity, AveragePrice: current.AveragePrice}, nil
}

// ValidateFloatCeiling confirma que a soma das posições de todos os
// detentores de um ativo (usuários + bots) nunca excede outstandingShares —
// float finito (tarefa A.3). Uma ordem normal nunca deveria violar isso:
// orderexecution.Execute só transfere quantidade já existente de um
// detentor pra outro (nunca cria posição do nada, exceto liquidez sintética
// de sandbox, fora do escopo desse teto), então essa validação só pode
// falhar por uma distribuição inicial malformada (Fase B) — é proteção de
// invariante, não regra de negócio que trava negociação legítima.
func ValidateFloatCeiling(totalHeld, outstandingShares int64) error {
	if totalHeld > outstandingShares {
		return ErrFloatExceeded
	}
	return nil
}

// Record é uma Position enriquecida com a identificação do ativo (ticker,
// nome, tipo) pra leitura (GET /positions, tarefa 4.7) — os três campos
// vêm crus (não catalog.AssetType) pra este pacote não precisar importar
// catalog só pra exibição, mesma convenção já usada em
// tick.AssetForPricing.Sector. IsSandbox (tarefa 4.11, RF12) distingue
// posição de sandbox de posição do Mercado Ao Vivo — insumo pra tela 2.1
// (inventário) separar visualmente as duas, e pro futuro replay de ranking
// (backlog 5.x) filtrar sandbox fora do cálculo.
type Record struct {
	AssetID     string
	AssetTicker string
	AssetName   string
	AssetType   string
	IsSandbox   bool
	Position
}
