import { describe, expect, it } from 'vitest'
import { budgetSplit } from '.'

const values = { housing: 1500, food: 800, transport: 400, leisure: 300, debts: 200, other: 200 }

describe('budgetMath', () => {
    it('sobra é renda menos gastos', () => {
        const result = budgetSplit(4000, values)
        expect(result.spent).toBe(3400)
        expect(result.surplus).toBe(600)
        expect(result.surplusPct).toBeCloseTo(15, 6)
        expect(result.overspent).toBe(false)
    })

    it('divide a renda nas fatias da regra de bolso 50/30/20', () => {
        const result = budgetSplit(4000, values)
        expect(result.needsPct).toBeCloseTo(67.5, 6)
        expect(result.wantsPct).toBeCloseTo(12.5, 6)
        expect(result.saveDebtPct).toBeCloseTo(20, 6)
    })

    it('gasto acima da renda dá sobra negativa e marca o vermelho', () => {
        const result = budgetSplit(3000, values)
        expect(result.surplus).toBe(-400)
        expect(result.overspent).toBe(true)
    })

    it('renda zero não divide por zero', () => {
        expect(budgetSplit(0, values).surplusPct).toBe(0)
    })
})
