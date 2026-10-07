import { describe, expect, it } from 'vitest'
import { dividendTimelineResult, etfShock, fiiMonthLabels, fiiYearSummary, hasDividendRight, proventoNet } from '.'

describe('hasDividendRight', () => {
    it.each([
        ['buy', 2, true],
        ['buy', 3, true],
        ['buy', 4, false],
        ['buy', 9, false],
        ['sell', 2, false],
        ['sell', 3, false],
        ['sell', 4, true],
        ['sell', 9, true],
    ] as const)('%s no dia %i (data com 3): %s', (side, day, want) => {
        expect(hasDividendRight(side, day, 3)).toBe(want)
    })
})

describe('dividendTimelineResult', () => {
    it('100 ações a R$ 1,00 por ação, comprando na data com: recebe R$ 100,00', () => {
        expect(dividendTimelineResult('buy', 3, 3, 100, 1)).toEqual({ receives: true, gross: 100, priceDropPerShare: 1 })
    })
    it('comprando na data ex: não recebe, mas o preço já caiu o valor do provento', () => {
        expect(dividendTimelineResult('buy', 4, 3, 100, 1)).toEqual({ receives: false, gross: 0, priceDropPerShare: 1 })
    })
})

describe('proventoNet', () => {
    const base = { quantity: 1000, valuePerShare: 1, otherSameMonth: 0, resultsUntil2025: false }

    it.each([
        ['dividendo abaixo de R$ 50 mil no mês: sem retenção', { ...base, kind: 'dividend' as const }, 0, 1000, 'dividend-below-threshold'],
        [
            'dividendo com o total do mês acima de R$ 50 mil: 10% sobre este pagamento',
            { ...base, kind: 'dividend' as const, otherSameMonth: 60_000 },
            100,
            900,
            'dividend-above-threshold',
        ],
        [
            'total do mês exatamente R$ 50 mil não passa do limite',
            { ...base, kind: 'dividend' as const, otherSameMonth: 49_000 },
            0,
            1000,
            'dividend-below-threshold',
        ],
        [
            'lucro de 2025 aprovado até 31/12/2025 segue isento mesmo com total alto',
            { ...base, kind: 'dividend' as const, otherSameMonth: 90_000, resultsUntil2025: true },
            0,
            1000,
            'dividend-exempt-legacy',
        ],
        ['JCP: 17,5% de R$ 1.000 são R$ 175', { ...base, kind: 'jcp' as const }, 175, 825, 'jcp'],
        ['JCP não tem a isenção do lucro de 2025', { ...base, kind: 'jcp' as const, resultsUntil2025: true }, 175, 825, 'jcp'],
    ])('%s', (_name, input, withheld, net, ruleKey) => {
        const result = proventoNet(input)
        expect(result.withheld).toBeCloseTo(withheld, 6)
        expect(result.net).toBeCloseTo(net, 6)
        expect(result.ruleKey).toBe(ruleKey)
    })
})

describe('etfShock', () => {
    const basket = [
        { name: 'A', weightPct: 40 },
        { name: 'B', weightPct: 20 },
        { name: 'C', weightPct: 25 },
        { name: 'D', weightPct: 15 },
    ]

    it('A com 40% da cesta cai 20% e o resto fica parado: o ETF cai 8%', () => {
        const result = etfShock(basket, [-20, 0, 0, 0], 100)
        expect(result.changePct).toBeCloseTo(-8, 9)
        expect(result.navAfter).toBeCloseTo(92, 9)
        expect(result.contributions[0]).toBeCloseTo(-8, 9)
    })

    it('todos caem 10%: o ETF cai 10%', () => {
        expect(etfShock(basket, [-10, -10, -10, -10], 100).changePct).toBeCloseTo(-10, 9)
    })
})

describe('fiiYearSummary', () => {
    it('R$ 1,00 por mês numa cota de R$ 100: 12% ao ano, e 100 cotas rendem R$ 1.200', () => {
        expect(fiiYearSummary(1, 100, 100)).toEqual({ annualPerShare: 12, annualTotal: 1200, dividendYieldPct: 12 })
    })
    it('preço zero não divide por zero', () => {
        expect(fiiYearSummary(1, 100, 0).dividendYieldPct).toBe(0)
    })
})

describe('fiiMonthLabels', () => {
    it('março: com no último dia útil de março, ex e pagamento em abril', () => {
        expect(fiiMonthLabels(2, 10)).toEqual({ com: 'último dia útil de março', ex: '1º dia útil de abril', pay: '10º dia útil de abril' })
    })
    it('dezembro vira o ano', () => {
        expect(fiiMonthLabels(11, 5).ex).toBe('1º dia útil de janeiro')
    })
})
