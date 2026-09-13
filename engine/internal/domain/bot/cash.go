package bot

// MarketMakerCashMultiplier/OtherCashMultiplier convertem o valor de
// mercado da posição que um bot recebeu (InitialAllocation, tarefa B.1) em
// caixa inicial (accounts.current_balance) — "correlacionado ao papel do
// bot" (proposta 2.2, tarefa B.2). O Market Maker precisa sustentar oferta
// nos dois lados do book a cada rodada (arquétipo da tarefa C.3, ainda não
// implementado), então recebe mais caixa livre por real de posição
// carregada do que um bot direcional, que tolera carregar mais posição do
// que caixa disponível — sem personalidade própria ainda (Fase C), este é
// o "valor proporcional simples" que a descrição de B.2 pede até lá.
const (
	MarketMakerCashMultiplier = 2.0
	OtherCashMultiplier       = 0.5
)

// InitialCash converte o valor de mercado da posição de um bot
// (positionMarketValue = quantidade × preço de referência, agregado por
// todos os ativos que ele detém) em caixa inicial, pelo papel do bot
// (Market Maker vs. direcional) — nunca abaixo de minimumCash: sem esse
// piso, um bot que recebeu uma fatia muito pequena do float (cauda da
// distribuição de InitialAllocation, tarefa B.1) nasceria sem caixa
// suficiente pra sequer uma ordem de tamanho médio no próprio ativo que
// detém, mesmo tendo posição.
func InitialCash(positionMarketValue, minimumCash float64, isMarketMaker bool) float64 {
	multiplier := OtherCashMultiplier
	if isMarketMaker {
		multiplier = MarketMakerCashMultiplier
	}
	if cash := positionMarketValue * multiplier; cash > minimumCash {
		return cash
	}
	return minimumCash
}
