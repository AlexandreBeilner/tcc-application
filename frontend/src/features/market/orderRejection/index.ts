import { ApiError } from '../../../services/client'
import { apiErrorCode } from '../../../utils/formatApiError'
import { maxAffordableQuantity } from '../orderBook'
import type { AssetBook } from '../../../services/market'

export type OrderRejectionKind = 'insufficient_balance' | 'insufficient_position'

// Distingue as duas causas de `422` de `POST /market/orders` que não são
// `market_closed` (S.11, tem `code` próprio) nem a ordem pendurada "furada"
// (`ErrRestingOrderNoLongerAvailable`, `.docs/engine/orders.md`) — o motor
// devolve as duas com o mesmo status e sem `code`; o backend
// (`engineErrorTranslator`, RC.1.5) as traduz para `insufficient_balance`/
// `insufficient_position` (achado 021, tarefa S.7: "o 422 de saldo/quantidade
// ganha mensagem clara").
export function classifyOrderRejection(err: unknown): OrderRejectionKind | null {
    if (!(err instanceof ApiError) || err.status !== 422) return null

    // `code` estável vindo do backend (`engineErrorTranslator`, RC.1.5), nunca o texto.
    const code = apiErrorCode(err)
    if (code === 'insufficient_balance') return 'insufficient_balance'
    if (code === 'insufficient_position') return 'insufficient_position'
    return null
}

// Mensagem clara com a quantidade máxima possível (achado 021, decisão do
// autor 2026-09-26) em vez do "saldo insuficiente"/"quantidade em posição
// insuficiente" genérico do motor. Compra: máximo calculado pela
// profundidade real do book (`maxAffordableQuantity`, mesma conta do botão
// "Usar o máximo" do painel "Nova ordem"). Venda: máximo é a própria
// posição em carteira, não depende do book.
export function describeOrderRejection(
    kind: OrderRejectionKind,
    ticker: string,
    book: AssetBook | undefined,
    cashBalance: number | undefined,
    ownedQuantity: number | undefined,
): string {
    if (kind === 'insufficient_balance') {
        const max = maxAffordableQuantity(book?.asks ?? null, cashBalance ?? 0)
        return max > 0
            ? `Saldo insuficiente para essa quantidade. Com o saldo e o book atuais, dá pra comprar no máximo ${max} ${ticker}.`
            : `Saldo insuficiente para comprar ${ticker} agora, mesmo em quantidade menor.`
    }

    const max = ownedQuantity ?? 0
    return max > 0
        ? `Você só tem ${max} ${ticker} disponíveis pra vender.`
        : `Você não tem ${ticker} suficiente em carteira pra essa venda.`
}
