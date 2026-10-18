import { describe, expect, it } from 'vitest'
import { replay, type MarketEventRecord } from './networth'
import { investmentReturnPct, toRiskCapitalSnapshot } from './profitability'

function event(
  partial: Partial<MarketEventRecord> & Pick<MarketEventRecord, 'eventType'>,
): MarketEventRecord {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date('2026-01-01T00:00:00Z'),
    ...partial,
  }
}

describe('replay', () => {
  it('initial_deposit define o caixa inicial (RNF06)', () => {
    const events = [event({ eventType: 'initial_deposit', unitValue: 10000 })]

    const snapshot = replay(events, new Map(), new Set())

    expect(snapshot).toEqual({
      cash: 10000,
      variableIncomeValue: 0,
      fixedIncomeValue: 0,
      tradesExecuted: 0,
      total: 10000,
      investedCost: 0,
      disinvestedProceeds: 0,
      dividendsReceived: 0,
      byClass: {
        fixedIncome: { investedCost: 0, disinvestedProceeds: 0, dividendsReceived: 0 },
        variableIncome: { investedCost: 0, disinvestedProceeds: 0, dividendsReceived: 0 },
      },
    })
  })

  it('compra de ação debita caixa e acumula quantidade, valorizada pela cotação em asOf', () => {
    const events = [
      event({ eventType: 'initial_deposit', unitValue: 10000 }),
      event({ eventType: 'buy_order_executed', assetId: 'a1', quantity: 10, unitValue: 50 }),
    ]
    const quotesAsOf = new Map([['a1', 60]])

    const snapshot = replay(events, quotesAsOf, new Set())

    expect(snapshot.cash).toBe(10000 - 10 * 50)
    expect(snapshot.variableIncomeValue).toBe(10 * 60)
    expect(snapshot.tradesExecuted).toBe(1)
    expect(snapshot.total).toBe(snapshot.cash + snapshot.variableIncomeValue)
    // investedCost (tarefa T.1) é bruto — soma o custo da compra, nunca
    // reduzido por venda (simétrico de accounts.total_invested no motor).
    expect(snapshot.investedCost).toBe(10 * 50)
  })

  it('venda credita caixa e reduz a quantidade acumulada', () => {
    const events = [
      event({ eventType: 'initial_deposit', unitValue: 10000 }),
      event({ eventType: 'buy_order_executed', assetId: 'a1', quantity: 10, unitValue: 50 }),
      event({ eventType: 'sell_order_executed', assetId: 'a1', quantity: 4, unitValue: 55 }),
    ]
    const quotesAsOf = new Map([['a1', 60]])

    const snapshot = replay(events, quotesAsOf, new Set())

    expect(snapshot.cash).toBe(10000 - 10 * 50 + 4 * 55)
    expect(snapshot.variableIncomeValue).toBe(6 * 60)
    expect(snapshot.tradesExecuted).toBe(2)
    // investedCost não é reduzido pela venda (bruto histórico); a venda só
    // soma em disinvestedProceeds — nunca líquidos entre si (tarefa T.1).
    expect(snapshot.investedCost).toBe(10 * 50)
    expect(snapshot.disinvestedProceeds).toBe(4 * 55)
  })

  it('compra de renda fixa debita caixa e acumula valor a custo (sem marcação a mercado)', () => {
    const events = [
      event({ eventType: 'initial_deposit', unitValue: 10000 }),
      event({ eventType: 'fixed_income_purchase', assetId: 'ri1', unitValue: 1000 }),
    ]

    const snapshot = replay(events, new Map(), new Set())

    expect(snapshot.cash).toBe(9000)
    expect(snapshot.fixedIncomeValue).toBe(1000)
    // Renda fixa não conta pra tradesExecuted (só buy/sell_order_executed).
    expect(snapshot.tradesExecuted).toBe(0)
    expect(snapshot.investedCost).toBe(1000)
  })

  it('resgate de renda fixa credita caixa e zera o custo acumulado do título (resgate integral)', () => {
    const events = [
      event({ eventType: 'initial_deposit', unitValue: 10000 }),
      event({ eventType: 'fixed_income_purchase', assetId: 'ri1', unitValue: 1000 }),
      event({ eventType: 'fixed_income_redemption', assetId: 'ri1', unitValue: 1080 }),
    ]

    const snapshot = replay(events, new Map(), new Set())

    expect(snapshot.cash).toBe(10000 - 1000 + 1080)
    expect(snapshot.fixedIncomeValue).toBe(0)
    // Resgate soma em disinvestedProceeds pelo valor bruto (nunca decrementa
    // investedCost — mesmo precedente do lado de venda de renda variável).
    expect(snapshot.investedCost).toBe(1000)
    expect(snapshot.disinvestedProceeds).toBe(1080)
  })

  it('dividend_payment credita caixa por quantidade × valor por cota', () => {
    const events = [
      event({ eventType: 'initial_deposit', unitValue: 10000 }),
      event({ eventType: 'dividend_payment', assetId: 'a1', quantity: 100, unitValue: 1.5 }),
    ]

    const snapshot = replay(events, new Map(), new Set())

    expect(snapshot.cash).toBe(10000 + 100 * 1.5)
    expect(snapshot.dividendsReceived).toBe(100 * 1.5)
  })

  it('admin_credit e salary_payment são caixa livre: não entram no capital de risco, então não mexem na rentabilidade (N.17, T.1)', () => {
    const base = [
      event({ eventType: 'initial_deposit', unitValue: 10000 }),
      event({ eventType: 'buy_order_executed', assetId: 'a1', quantity: 10, unitValue: 50 }),
    ]
    const withCredits = [
      ...base,
      event({ eventType: 'admin_credit', unitValue: 5_000_000 }),
      event({ eventType: 'salary_payment', unitValue: 3000 }),
    ]
    const quotes = new Map([['a1', 60]])

    const before = replay(base, quotes, new Set())
    const after = replay(withCredits, quotes, new Set())

    expect(after.investedCost).toBe(before.investedCost)
    expect(after.disinvestedProceeds).toBe(before.disinvestedProceeds)
    expect(after.dividendsReceived).toBe(before.dividendsReceived)
    expect(after.variableIncomeValue).toBe(before.variableIncomeValue)
    expect(after.tradesExecuted).toBe(before.tradesExecuted)
    expect(toRiskCapitalSnapshot(after)).toEqual(toRiskCapitalSnapshot(before))
    expect(investmentReturnPct(toRiskCapitalSnapshot(after))).toBe(
      investmentReturnPct(toRiskCapitalSnapshot(before)),
    )
  })

  it('exclui posição e caixa de ativo sandbox: só o Mercado Ao Vivo move o caixa (ponto 063)', () => {
    const events = [
      event({ eventType: 'initial_deposit', unitValue: 10000 }),
      event({ eventType: 'buy_order_executed', assetId: 'sand1', quantity: 10, unitValue: 100 }),
      event({ eventType: 'buy_order_executed', assetId: 'a1', quantity: 5, unitValue: 50 }),
    ]
    const quotesAsOf = new Map([
      ['sand1', 103],
      ['a1', 60],
    ])
    const sandboxAssetIds = new Set(['sand1'])

    const snapshot = replay(events, quotesAsOf, sandboxAssetIds)

    // Só a compra real debita: o motor não mexe no caixa com ativo sandbox,
    // mesmo saldo que GET /accounts/:user_id mostraria agora.
    expect(snapshot.cash).toBe(10000 - 5 * 50)
    // Só o ativo de Mercado Ao Vivo entra na valorização.
    expect(snapshot.variableIncomeValue).toBe(5 * 60)
    // Só a operação do Mercado Ao Vivo conta (conquista "Primeira Operação", duelos).
    expect(snapshot.tradesExecuted).toBe(1)
  })

  it('compra de renda fixa sandbox não entra na valorização nem mexe no caixa', () => {
    const events = [
      event({ eventType: 'initial_deposit', unitValue: 10000 }),
      event({ eventType: 'fixed_income_purchase', assetId: 'sandpre', unitValue: 500 }),
    ]
    const sandboxAssetIds = new Set(['sandpre'])

    const snapshot = replay(events, new Map(), sandboxAssetIds)

    expect(snapshot.cash).toBe(10000)
    expect(snapshot.fixedIncomeValue).toBe(0)
  })

  it('investedCost e disinvestedProceeds ignoram sandbox, igual aos acumuladores do motor (accounts.total_invested/total_disinvested, ponto 063)', () => {
    const events = [
      event({ eventType: 'initial_deposit', unitValue: 10000 }),
      event({ eventType: 'buy_order_executed', assetId: 'sand1', quantity: 10, unitValue: 100 }),
      event({ eventType: 'sell_order_executed', assetId: 'sand1', quantity: 10, unitValue: 103 }),
    ]
    const sandboxAssetIds = new Set(['sand1'])

    const snapshot = replay(events, new Map([['sand1', 100]]), sandboxAssetIds)

    expect(snapshot.variableIncomeValue).toBe(0)
    expect(snapshot.investedCost).toBe(0)
    expect(snapshot.disinvestedProceeds).toBe(0)
    expect(snapshot.cash).toBe(10000)
  })

  it('cenário combinado: compra, venda e resgate de renda fixa entre início da janela e agora', () => {
    const events = [
      event({ eventType: 'initial_deposit', unitValue: 10000 }),
      event({ eventType: 'buy_order_executed', assetId: 'a1', quantity: 20, unitValue: 40 }),
      event({ eventType: 'fixed_income_purchase', assetId: 'ri1', unitValue: 2000 }),
      event({ eventType: 'sell_order_executed', assetId: 'a1', quantity: 5, unitValue: 45 }),
      event({ eventType: 'fixed_income_redemption', assetId: 'ri1', unitValue: 2100 }),
    ]
    const quotesAsOf = new Map([['a1', 42]])

    const snapshot = replay(events, quotesAsOf, new Set())

    const expectedCash = 10000 - 20 * 40 - 2000 + 5 * 45 + 2100
    expect(snapshot.cash).toBe(expectedCash)
    expect(snapshot.variableIncomeValue).toBe(15 * 42)
    expect(snapshot.fixedIncomeValue).toBe(0)
    expect(snapshot.tradesExecuted).toBe(2)
    expect(snapshot.total).toBe(expectedCash + 15 * 42)
    expect(snapshot.investedCost).toBe(20 * 40 + 2000)
    expect(snapshot.disinvestedProceeds).toBe(5 * 45 + 2100)
  })

  describe('fluxos por classe (byClass)', () => {
    it('separa custo, vendas e proventos de renda variável e custo e resgate de renda fixa', () => {
      const events = [
        event({ eventType: 'initial_deposit', unitValue: 10000 }),
        event({ eventType: 'buy_order_executed', assetId: 'acao', quantity: 10, unitValue: 50 }),
        event({ eventType: 'sell_order_executed', assetId: 'acao', quantity: 4, unitValue: 60 }),
        event({ eventType: 'dividend_payment', assetId: 'acao', quantity: 6, unitValue: 2 }),
        event({ eventType: 'fixed_income_purchase', assetId: 'cdb', unitValue: 1000 }),
        event({ eventType: 'fixed_income_redemption', assetId: 'cdb', unitValue: 1080 }),
      ]

      const { byClass } = replay(events, new Map([['acao', 55]]), new Set())

      expect(byClass?.variableIncome).toEqual({
        investedCost: 500,
        disinvestedProceeds: 240,
        dividendsReceived: 12,
      })
      expect(byClass?.fixedIncome).toEqual({
        investedCost: 1000,
        disinvestedProceeds: 1080,
        dividendsReceived: 0,
      })
    })

    it('ativo sandbox nunca entra nos fluxos por classe nem nos totais da conta', () => {
      const events = [
        event({ eventType: 'initial_deposit', unitValue: 10000 }),
        event({ eventType: 'buy_order_executed', assetId: 'sbx', quantity: 10, unitValue: 50 }),
        event({ eventType: 'fixed_income_purchase', assetId: 'sbx-rf', unitValue: 300 }),
      ]

      const snapshot = replay(events, new Map(), new Set(['sbx', 'sbx-rf']))

      expect(snapshot.investedCost).toBe(0)
      expect(snapshot.byClass?.variableIncome.investedCost).toBe(0)
      expect(snapshot.byClass?.fixedIncome.investedCost).toBe(0)
    })
  })
})
