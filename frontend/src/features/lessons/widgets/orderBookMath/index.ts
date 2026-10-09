// Livro de ofertas didático (RC.3.4e). Funções puras, preços em centavos para
// não acumular erro de ponto flutuante. Compra executa contra as vendas do
// menor preço para o maior; venda executa contra as compras do maior para o menor.
export interface Level {
    priceCents: number
    qty: number
}

export interface Book {
    bids: Level[]
    asks: Level[]
    lastCents: number
}

export type Side = 'buy' | 'sell'

export interface OrderInput {
    side: Side
    type: 'market' | 'limit'
    qty: number
    limitCents?: number
}

export interface Fill {
    priceCents: number
    qty: number
}

export interface MatchResult {
    book: Book
    fills: Fill[]
    filledQty: number
    avgCents: number | null
    slippageCents: number | null
    restingQty: number
    unfilledQty: number
}

export const INITIAL_BOOK: Book = {
    bids: [
        { priceCents: 1000, qty: 300 },
        { priceCents: 995, qty: 500 },
        { priceCents: 990, qty: 800 },
        { priceCents: 985, qty: 1000 },
    ],
    asks: [
        { priceCents: 1005, qty: 300 },
        { priceCents: 1010, qty: 500 },
        { priceCents: 1015, qty: 800 },
        { priceCents: 1020, qty: 1000 },
    ],
    lastCents: 1000,
}

export function spreadCents(book: Book): number | null {
    if (book.bids.length === 0 || book.asks.length === 0) return null
    return book.asks[0].priceCents - book.bids[0].priceCents
}

function addResting(levels: Level[], level: Level, side: Side): Level[] {
    const merged = levels.some((l) => l.priceCents === level.priceCents)
        ? levels.map((l) => (l.priceCents === level.priceCents ? { ...l, qty: l.qty + level.qty } : l))
        : [...levels, level]
    return merged.sort((a, b) => (side === 'buy' ? b.priceCents - a.priceCents : a.priceCents - b.priceCents))
}

export function matchOrder(book: Book, order: OrderInput): MatchResult {
    const buying = order.side === 'buy'
    const opposite = (buying ? book.asks : book.bids).map((l) => ({ ...l }))
    const bestBefore = opposite[0]?.priceCents ?? null
    const fills: Fill[] = []
    let remaining = order.qty

    while (remaining > 0 && opposite.length > 0) {
        const top = opposite[0]
        const crosses =
            order.type === 'market' ||
            (buying ? top.priceCents <= (order.limitCents ?? 0) : top.priceCents >= (order.limitCents ?? Infinity))
        if (!crosses) break
        const take = Math.min(remaining, top.qty)
        fills.push({ priceCents: top.priceCents, qty: take })
        remaining -= take
        top.qty -= take
        if (top.qty === 0) opposite.shift()
    }

    const filledQty = order.qty - remaining
    const totalCents = fills.reduce((sum, fill) => sum + fill.priceCents * fill.qty, 0)
    const avgCents = filledQty > 0 ? totalCents / filledQty : null
    const slippageCents = avgCents === null || bestBefore === null ? null : buying ? avgCents - bestBefore : bestBefore - avgCents

    let bids = buying ? book.bids : opposite
    let asks = buying ? opposite : book.asks
    let restingQty = 0
    if (remaining > 0 && order.type === 'limit' && order.limitCents !== undefined) {
        restingQty = remaining
        const level = { priceCents: order.limitCents, qty: remaining }
        if (buying) bids = addResting(bids, level, 'buy')
        else asks = addResting(asks, level, 'sell')
    }

    return {
        book: { bids, asks, lastCents: fills.length > 0 ? fills[fills.length - 1].priceCents : book.lastCents },
        fills,
        filledQty,
        avgCents,
        slippageCents,
        restingQty,
        unfilledQty: order.type === 'market' ? remaining : 0,
    }
}
