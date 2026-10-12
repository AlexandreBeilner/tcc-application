import { categoryOfType } from '../distribution'
import { positionCurrentValue } from '../positionValue'
import type { EquityReturn, PortfolioReturns, PortfolioSummary, PositionReturn, ReturnPositionInput } from './types'

export type { EquityReturn, PortfolioReturns, PortfolioSummary, PositionReturn, ReturnPositionInput } from './types'

function ratio(amount: number, cost: number): number | null {
    return cost > 0 ? amount / cost : null
}

// Renda variável: a conta do `PositionSummaryCard` da página do ativo, extraída aqui para a tela
// "Meus ativos" (MO.8.3) e a página do ativo nunca divergirem. Preço atual = marcação a mercado,
// com o preço médio como queda quando não há cotação (sandbox ou ativo sem negócio).
export function calculateEquityReturn(input: {
    quantity: number
    averagePrice: number
    markPrice?: number
    dividendsReceived?: number
}): EquityReturn {
    const currentPrice = input.markPrice ?? input.averagePrice
    const cost = input.averagePrice * input.quantity
    const priceResult = (currentPrice - input.averagePrice) * input.quantity
    return {
        currentPrice,
        priceReturn: ratio(priceResult, cost),
        totalReturn: ratio(priceResult + (input.dividendsReceived ?? 0), cost),
    }
}

function toPositionReturn(position: ReturnPositionInput, isFixedIncome: boolean): PositionReturn {
    const cost = position.quantity * position.averagePrice
    const currentValue = positionCurrentValue(position)
    const dividendsReceived = position.dividendsReceived ?? 0
    const resultAmount = currentValue - cost
    return {
        assetId: position.assetId,
        ticker: position.ticker,
        name: position.name,
        type: position.type,
        category: categoryOfType(position.type),
        isSandbox: position.isSandbox,
        isFixedIncome,
        quantity: position.quantity,
        averagePrice: position.averagePrice,
        cost,
        currentValue,
        valued: !isFixedIncome || position.currentValue !== undefined || position.isSandbox,
        resultAmount,
        resultRatio: ratio(resultAmount, cost),
        dividendsReceived,
        totalResultAmount: resultAmount + dividendsReceived,
        totalResultRatio: ratio(resultAmount + dividendsReceived, cost),
        netValue: isFixedIncome ? position.netValue : undefined,
        weight: 0,
    }
}

function summarize(rows: PositionReturn[]): PortfolioSummary {
    const cost = rows.reduce((sum, row) => sum + row.cost, 0)
    const currentValue = rows.reduce((sum, row) => sum + row.currentValue, 0)
    const dividendsReceived = rows.reduce((sum, row) => sum + row.dividendsReceived, 0)
    const resultAmount = currentValue - cost
    return {
        cost,
        currentValue,
        resultAmount,
        resultRatio: ratio(resultAmount, cost),
        dividendsReceived,
        totalResultAmount: resultAmount + dividendsReceived,
        totalResultRatio: ratio(resultAmount + dividendsReceived, cost),
    }
}

function withWeights(rows: PositionReturn[]): PositionReturn[] {
    const total = rows.reduce((sum, row) => sum + row.currentValue, 0)
    return rows.map((row) => ({ ...row, weight: total > 0 ? row.currentValue / total : 0 }))
}

// Posição zerada continua vindo da API (UPSERT, nunca DELETE), então só `quantity > 0` é posição.
// Ao vivo e Sandbox ficam separados, cada um com o próprio resumo e os próprios pesos: o Modo
// Aprendizado nunca entra nos totais do Mercado Ao Vivo (RF12/RNF08). Ordem: maior valor primeiro.
export function buildPortfolioReturns(account: {
    positions: ReturnPositionInput[]
    fixedIncomePositions: ReturnPositionInput[]
}): PortfolioReturns {
    const rows = [
        ...account.positions.filter((p) => p.quantity > 0).map((p) => toPositionReturn(p, false)),
        ...account.fixedIncomePositions.filter((p) => p.quantity > 0).map((p) => toPositionReturn(p, true)),
    ].sort((a, b) => b.currentValue - a.currentValue)

    const live = withWeights(rows.filter((row) => !row.isSandbox))
    const sandbox = withWeights(rows.filter((row) => row.isSandbox))
    return { live, sandbox, liveSummary: summarize(live), sandboxSummary: summarize(sandbox) }
}
