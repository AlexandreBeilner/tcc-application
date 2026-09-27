// Preço de marcação a mercado de uma posição de renda variável (tarefa
// S.6): o ponto médio do book (`GET /market/assets/:id/book`, tarefa S.5)
// quando os dois lados têm oferta pendente, senão o último preço negociado.
// Um negócio de 1 cota nunca move essa marcação além do ponto médio
// corrente — só move o último preço negociado, que só entra como fallback
// quando falta um dos lados do book (critério de aceite: nenhuma
// manipulação por wash trade).
export function markPrice(bookMidPrice: number | null, lastTradePrice: number): number {
  return bookMidPrice ?? lastTradePrice
}
