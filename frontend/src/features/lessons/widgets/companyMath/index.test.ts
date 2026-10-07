import { describe, expect, it } from 'vitest'
import { balanceSheet, debtReading, dre, dupont, marginPct, multiples, shockedFinancialExpense } from '.'

describe('dre', () => {
    it('receita 1.000, custos e despesas de 700, juros de 100 e imposto de 34% dão lucro de 132', () => {
        const r = dre(1000, 55, 15, -100, 34)
        expect(r.grossProfit).toBeCloseTo(450)
        expect(r.ebit).toBeCloseTo(300)
        expect(r.ebt).toBeCloseTo(200)
        expect(r.tax).toBeCloseTo(68)
        expect(r.netIncome).toBeCloseTo(132)
    })

    it('prejuízo antes do imposto não paga imposto', () => {
        const r = dre(1000, 70, 20, -200, 34)
        expect(r.ebt).toBeCloseTo(-100)
        expect(r.tax).toBe(0)
        expect(r.netIncome).toBeCloseTo(-100)
    })
})

describe('balanceSheet', () => {
    it.each([
        [200, 300, 220, 100, 180],
        [100, 100, 150, 100, -50],
    ])('ativo %d + %d, passivo %d + %d: PL %d', (cash, fixed, debt, other, equity) => {
        expect(balanceSheet(cash, fixed, debt, other).equity).toBe(equity)
    })

    it('ativo de 500 e passivo de 320 dão PL de 180', () => {
        const b = balanceSheet(200, 300, 220, 100)
        expect([b.assets, b.liabilities, b.equity]).toEqual([500, 320, 180])
    })
})

describe('marginPct', () => {
    it('EBIT 200 sobre receita 1.000 é 20%, e receita zero não divide por zero', () => {
        expect(marginPct(200, 1000)).toBe(20)
        expect(marginPct(200, 0)).toBe(0)
    })
})

describe('dupont', () => {
    it('lucro 30, patrimônio 200: ROE de 15%, e margem x giro x alavancagem bate com ele', () => {
        const d = dupont(600, 30, 400, 200)
        expect(d.roePct).toBeCloseTo(15)
        expect((d.marginPct / 100) * d.turnover * (d.leverage ?? 0) * 100).toBeCloseTo(15)
    })

    it('patrimônio zero ou negativo não tem ROE', () => {
        expect(dupont(600, 30, 400, 0).roePct).toBeNull()
        expect(dupont(600, 30, 400, -10).leverage).toBeNull()
    })

    it('dobrar a dívida com o mesmo lucro dobra o ROE', () => {
        expect(dupont(1000, 100, 1000, 500).roePct).toBeCloseTo(20)
        expect(dupont(1000, 100, 1000, 250).roePct).toBeCloseTo(40)
    })
})

describe('multiples', () => {
    it('lucro de 120 milhões, 60 milhões de ações, preço R$ 24: LPA 2 e P/L 12', () => {
        const m = multiples(24, 120, 300, 60)
        expect(m.eps).toBe(2)
        expect(m.pe).toBe(12)
        expect(m.earningsYieldPct).toBeCloseTo(8.333, 2)
    })

    it('patrimônio de 300 milhões, 100 milhões de ações, preço R$ 2,40: P/VP 0,8', () => {
        expect(multiples(2.4, 50, 300, 100).pb).toBeCloseTo(0.8)
    })

    it('prejuízo não tem P/L', () => {
        expect(multiples(10, -5, 100, 10).pe).toBeNull()
    })

    it('valor de mercado é o preço vezes as ações', () => {
        expect(multiples(10, 5, 100, 20).marketCap).toBe(200)
    })
})

describe('debtReading', () => {
    it.each([
        [800, 300, 250, 'low', 2],
        [800, 300, 150, 'attention', 3.33],
        [800, 100, 150, 'pressure', 4.67],
    ])('dívida bruta %d, caixa %d, EBIT %d: zona %s', (debt, cash, ebit, zone, ratio) => {
        const r = debtReading(debt, cash, ebit, 50)
        expect(r.zone).toBe(zone)
        expect(r.netDebtToEbit).toBeCloseTo(ratio, 1)
    })

    it('dívida líquida negativa quer dizer mais caixa que dívida', () => {
        expect(debtReading(100, 300, 50, 10).netDebt).toBe(-200)
    })

    it('sem EBIT positivo não há zona', () => {
        expect(debtReading(100, 10, 0, 10).zone).toBe('none')
    })

    it('cobertura de juros é EBIT sobre despesa financeira', () => {
        expect(debtReading(800, 300, 250, 50).coverage).toBe(5)
    })
})

describe('shockedFinancialExpense', () => {
    it('3 pontos sobre dívida de 800 toda em CDI somam 24', () => {
        expect(shockedFinancialExpense(50, 800, 100, 3)).toBeCloseTo(74)
    })

    it('dívida sem CDI não sente o choque', () => {
        expect(shockedFinancialExpense(50, 800, 0, 3)).toBe(50)
    })
})
