import type { BookLevel } from '../../../services/market'

export interface ExecutionEstimate {
    filledQuantity: number
    totalCost: number
    averagePrice: number | null
    // `false` quando a profundidade visível (5 melhores preços, S.5) não
    // cobre a quantidade inteira pedida — o preço além disso é desconhecido
    // do cliente, só o motor sabe no momento real da execução.
    fullyEstimated: boolean
}

// Caminha os níveis do book (já ordenados do melhor pro pior preço pelo
// motor, `orderbook.BuildSnapshot`) simulando quanto da quantidade pedida
// seria preenchido e a que preço médio — mesma lógica que o matching real
// (`orderexecution.Execute`) usa, só que sem escrever nada.
export function estimateExecution(levels: BookLevel[] | null, quantity: number): ExecutionEstimate {
    if (quantity <= 0 || !levels || levels.length === 0) {
        return { filledQuantity: 0, totalCost: 0, averagePrice: null, fullyEstimated: false }
    }

    let remaining = quantity
    let cost = 0
    let filled = 0
    for (const level of levels) {
        if (remaining <= 0) break
        const take = Math.min(remaining, level.quantity)
        cost += take * level.price
        filled += take
        remaining -= take
    }

    return { filledQuantity: filled, totalCost: cost, averagePrice: filled > 0 ? cost / filled : null, fullyEstimated: remaining === 0 }
}

export interface OrderCostEstimate {
    unitPrice: number | undefined
    total: number | undefined
    // `true` quando o número extrapola além da profundidade visível do book
    // (achado 021: "custo estimado", não garantia de preço final).
    boundedByDepth: boolean
}

// Custo estimado pra tela (achado 021/tarefa S.7): caminha o book pro lado
// certo da ordem (asks pra compra, bids pra venda) e, se a profundidade
// visível não cobrir a quantidade inteira, extrapola o resto pelo preço
// médio já encontrado (ou pelo último preço negociado, sem book nenhum) —
// mais fiel ao spread real do que assumir o último negócio pra tudo, que
// era a causa raiz do achado (all-in por último preço caindo em 422).
export function estimateOrderCost(levels: BookLevel[] | null, quantity: number, fallbackUnitPrice: number | undefined): OrderCostEstimate {
    if (quantity <= 0) {
        return { unitPrice: fallbackUnitPrice, total: undefined, boundedByDepth: false }
    }

    const execution = estimateExecution(levels, quantity)
    if (execution.filledQuantity === 0) {
        const total = fallbackUnitPrice !== undefined ? fallbackUnitPrice * quantity : undefined
        return { unitPrice: fallbackUnitPrice, total, boundedByDepth: false }
    }
    if (execution.fullyEstimated) {
        return { unitPrice: execution.averagePrice ?? undefined, total: execution.totalCost, boundedByDepth: false }
    }

    const remaining = quantity - execution.filledQuantity
    const extensionUnitPrice = execution.averagePrice ?? fallbackUnitPrice ?? 0
    const total = execution.totalCost + remaining * extensionUnitPrice
    return { unitPrice: total / quantity, total, boundedByDepth: true }
}

// "Comprar o máximo" (achado 021/tarefa S.7): caminha os `asks` do menor
// pro maior preço acumulando custo até o saldo em caixa não alcançar mais
// o próximo nível — mesmo raciocínio de `estimateExecution`, na direção
// inversa (quantidade máxima dado um orçamento, não custo dada uma
// quantidade).
export function maxAffordableQuantity(asks: BookLevel[] | null, cashBalance: number): number {
    if (!asks || cashBalance <= 0) return 0

    let remainingCash = cashBalance
    let quantity = 0
    for (const level of asks) {
        if (remainingCash <= 0) break
        const affordableAtLevel = Math.floor(remainingCash / level.price)
        if (affordableAtLevel <= 0) break
        const take = Math.min(affordableAtLevel, level.quantity)
        quantity += take
        remainingCash -= take * level.price
    }
    return quantity
}

// Preço médio executado (tarefa S.7, "resultado informa preço médio
// executado") — média ponderada pela quantidade de cada fill, real ou
// sintético (sandbox). `null` sem nenhum fill (nada executado).
export function averageFillPrice(fills: { price: number; quantity: number }[]): number | null {
    const totalQuantity = fills.reduce((sum, fill) => sum + fill.quantity, 0)
    if (totalQuantity === 0) return null
    const totalCost = fills.reduce((sum, fill) => sum + fill.price * fill.quantity, 0)
    return totalCost / totalQuantity
}
