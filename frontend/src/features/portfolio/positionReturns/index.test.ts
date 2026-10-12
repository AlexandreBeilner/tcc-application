import { describe, expect, it } from 'vitest'
import { groupPositionsByCategory } from '../distribution'
import { calculateAccountTotals } from '../accountTotals'
import { buildPortfolioReturns, calculateEquityReturn } from '.'
import type { ReturnPositionInput } from './types'

function equity(over: Partial<ReturnPositionInput>): ReturnPositionInput {
    return { assetId: 'a', ticker: 'PETR4', name: 'Petrobras', type: 'acao', isSandbox: false, quantity: 10, averagePrice: 30, ...over }
}
function fixed(over: Partial<ReturnPositionInput>): ReturnPositionInput {
    return { assetId: 'f', ticker: 'CDB1', name: 'CDB 1', type: 'cdb', isSandbox: false, quantity: 1, averagePrice: 1000, ...over }
}

describe('calculateEquityReturn', () => {
    it.each([
        { name: 'ganhando', mark: 33, div: 0, price: 0.1, total: 0.1 },
        { name: 'perdendo', mark: 27, div: 0, price: -0.1, total: -0.1 },
        { name: 'com provento', mark: 30, div: 15, price: 0, total: 0.05 },
        { name: 'sem marcação (cai no preço médio)', mark: undefined, div: 0, price: 0, total: 0 },
    ])('$name', ({ mark, div, price, total }) => {
        const r = calculateEquityReturn({ quantity: 10, averagePrice: 30, markPrice: mark, dividendsReceived: div })
        expect(r.currentPrice).toBe(mark ?? 30)
        expect(r.priceReturn).toBeCloseTo(price)
        expect(r.totalReturn).toBeCloseTo(total)
    })

    it('custo zero não gera NaN', () => {
        expect(calculateEquityReturn({ quantity: 0, averagePrice: 30 }).priceReturn).toBeNull()
    })
})

describe('buildPortfolioReturns', () => {
    it('renda variável: resultado, proventos e peso', () => {
        const { live, liveSummary } = buildPortfolioReturns({
            positions: [
                equity({ markPrice: 33, dividendsReceived: 15 }),
                equity({ assetId: 'b', ticker: 'VALE3', averagePrice: 10, markPrice: 8 }),
            ],
            fixedIncomePositions: [],
        })
        const petr = live.find((r) => r.ticker === 'PETR4')!
        expect(petr).toMatchObject({ cost: 300, currentValue: 330, resultAmount: 30, totalResultAmount: 45 })
        expect(petr.resultRatio).toBeCloseTo(0.1)
        expect(petr.weight).toBeCloseTo(330 / 410)
        expect(live[0].ticker).toBe('PETR4') // maior valor primeiro
        expect(liveSummary).toMatchObject({ cost: 400, currentValue: 410, resultAmount: 10, dividendsReceived: 15, totalResultAmount: 25 })
    })

    it('posição zerada fica fora', () => {
        const { live } = buildPortfolioReturns({ positions: [equity({ quantity: 0 })], fixedIncomePositions: [] })
        expect(live).toEqual([])
    })

    it('renda fixa avaliada usa o bruto e guarda o líquido', () => {
        const { live } = buildPortfolioReturns({ positions: [], fixedIncomePositions: [fixed({ currentValue: 1050, netValue: 1040 })] })
        expect(live[0]).toMatchObject({ currentValue: 1050, valued: true, resultAmount: 50, netValue: 1040 })
    })

    it('renda fixa sem avaliação cai no custo e se marca como não avaliada', () => {
        const { live } = buildPortfolioReturns({ positions: [], fixedIncomePositions: [fixed({})] })
        expect(live[0]).toMatchObject({ currentValue: 1000, valued: false, resultAmount: 0 })
        expect(live[0].netValue).toBeUndefined()
    })

    it('sandbox fica separado e fora do resumo ao vivo', () => {
        const r = buildPortfolioReturns({
            positions: [equity({ isSandbox: true, markPrice: undefined }), equity({ assetId: 'b', markPrice: 33 })],
            fixedIncomePositions: [fixed({ isSandbox: true })],
        })
        expect(r.live).toHaveLength(1)
        expect(r.sandbox).toHaveLength(2)
        expect(r.liveSummary.currentValue).toBe(330)
        expect(r.sandboxSummary.cost).toBe(1300)
        expect(r.sandbox.find((x) => x.isFixedIncome)?.valued).toBe(true)
    })

    it('a soma do valor atual por categoria bate com a rosca e com o card de patrimônio', () => {
        const positions = [
            equity({ markPrice: 33 }),
            equity({ assetId: 'c', type: 'fii', ticker: 'HGLG11', averagePrice: 100, quantity: 2, markPrice: 105 }),
        ]
        const fixedIncomePositions = [
            fixed({ currentValue: 1050, netValue: 1040 }),
            fixed({ assetId: 'g', type: 'tesouro_selic', currentValue: 2000 }),
        ]
        const { live, liveSummary } = buildPortfolioReturns({ positions, fixedIncomePositions })

        const slices = groupPositionsByCategory(positions, fixedIncomePositions)
        for (const slice of slices) {
            const sum = live.filter((r) => r.category === slice.category).reduce((s, r) => s + r.currentValue, 0)
            expect(sum).toBeCloseTo(slice.value)
        }
        expect(calculateAccountTotals(positions, fixedIncomePositions).liveInvested).toBeCloseTo(liveSummary.currentValue)
    })
})
