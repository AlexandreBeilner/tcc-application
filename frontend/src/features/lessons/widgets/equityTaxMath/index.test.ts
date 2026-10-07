import { describe, expect, it } from 'vitest'
import { darfAmount, equityTax, isExempt, rateFor, taxDecision } from '.'

const base = { kind: 'swing', assetClass: 'stock', salesMonth: 15000, profit: 2000, lossCarry: 0 } as const

describe('equityTaxMath', () => {
    it('ação com vendas até R$ 20 mil no mês é isenta, mesmo com lucro', () => {
        expect(equityTax(base)).toMatchObject({ rule: 'exempt', tax: 0 })
        expect(isExempt('swing', 'stock', 20000)).toBe(true)
    })

    it('passou de R$ 20 mil: 15% sobre todo o lucro, não só sobre o excedente', () => {
        const result = equityTax({ ...base, salesMonth: 30000, profit: 4000 })
        expect(result).toMatchObject({ rule: 'taxed', taxableBase: 4000, tax: 600 })
    })

    it('ETF e FII não têm a isenção', () => {
        expect(equityTax({ ...base, assetClass: 'etf' }).tax).toBe(300)
        expect(equityTax({ ...base, assetClass: 'fii' }).tax).toBe(400)
        expect(rateFor('swing', 'fii')).toBe(20)
    })

    it('day trade paga 20% e nunca é isento', () => {
        expect(equityTax({ ...base, kind: 'daytrade' })).toMatchObject({ rule: 'taxed', tax: 400 })
        expect(isExempt('daytrade', 'stock', 100)).toBe(false)
    })

    it('prejuízo acumulado compensa o lucro e o que sobra segue para os próximos meses', () => {
        const partial = equityTax({ ...base, salesMonth: 30000, profit: 4000, lossCarry: 1000 })
        expect(partial).toMatchObject({ rule: 'compensated', taxableBase: 3000, tax: 450, lossCarryAfter: 0 })
        const total = equityTax({ ...base, salesMonth: 30000, profit: 1000, lossCarry: 3000 })
        expect(total).toMatchObject({ tax: 0, lossCarryAfter: 2000 })
    })

    it('mês com prejuízo não paga e aumenta o prejuízo a compensar', () => {
        expect(equityTax({ ...base, profit: -500, lossCarry: 100 })).toMatchObject({ rule: 'loss', tax: 0, lossCarryAfter: 600 })
    })

    it('o dedo-duro do swing (0,005% das vendas) abate do DARF e nunca o deixa negativo', () => {
        const result = equityTax({ ...base, salesMonth: 100000, profit: 5000 })
        expect(result.withholding).toBeCloseTo(5, 6)
        expect(darfAmount(result)).toBeCloseTo(745, 6)
        expect(darfAmount(equityTax({ ...base, salesMonth: 100000, profit: 1, lossCarry: 0 }))).toBe(0)
    })

    it('a árvore de decisão cobre day trade, ação isenta, ação tributada, ETF e FII', () => {
        expect(taxDecision('stock', true, null).headline).toMatch(/Day trade: 20%/)
        expect(taxDecision('stock', false, true).headline).toMatch(/isento/)
        expect(taxDecision('stock', false, false).headline).toMatch(/15%/)
        expect(taxDecision('etf', false, null).headline).toMatch(/ETF: 15%/)
        expect(taxDecision('fii', false, null).headline).toMatch(/FII: 20%/)
    })
})
