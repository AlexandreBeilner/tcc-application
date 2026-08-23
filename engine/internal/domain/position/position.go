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
