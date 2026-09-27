// Preço de marcação a mercado de uma posição de renda variável (tarefa
// S.6): o ponto médio do book do motor (`GET /assets/:id/book`, tarefa S.5)
// quando os dois lados têm oferta pendente, senão o último preço negociado.
// Um negócio de 1 cota nunca move essa marcação além do ponto médio
// corrente — só move o último preço negociado, que só entra como fallback
// quando falta um dos lados do book (critério de aceite: nenhuma
// manipulação por wash trade). Duplicada de `modules/market/domain/
// markPrice.ts` (mesma decisão de pequena duplicação entre módulos já
// tomada em `inProcessProfitabilityReader.ts`, pra não criar uma
// dependência `ranking → market` só por uma função de 2 linhas).
export function markPrice(bookMidPrice: number | null, lastTradePrice: number): number {
  return bookMidPrice ?? lastTradePrice
}
