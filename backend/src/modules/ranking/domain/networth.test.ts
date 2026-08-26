import { describe, expect, it } from 'vitest'
import { replay, type MarketEventRecord } from './networth'

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
  })

  it('dividend_payment credita caixa por quantidade × valor por cota', () => {
    const events = [
      event({ eventType: 'initial_deposit', unitValue: 10000 }),
      event({ eventType: 'dividend_payment', assetId: 'a1', quantity: 100, unitValue: 1.5 }),
    ]

    const snapshot = replay(events, new Map(), new Set())

    expect(snapshot.cash).toBe(10000 + 100 * 1.5)
  })

  it('exclui posição de ativo sandbox da valorização, mas mantém o efeito real no caixa', () => {
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

    // Caixa reflete as duas compras — mesmo saldo que o motor de verdade
    // debitou (mesma convenção que GET /accounts/:user_id mostraria agora).
    expect(snapshot.cash).toBe(10000 - 10 * 100 - 5 * 50)
    // Só o ativo de Mercado Ao Vivo entra na valorização.
    expect(snapshot.variableIncomeValue).toBe(5 * 60)
    expect(snapshot.tradesExecuted).toBe(2)
  })

  it('exclui compra de renda fixa sandbox da valorização, mantendo o efeito no caixa', () => {
    const events = [
      event({ eventType: 'initial_deposit', unitValue: 10000 }),
      event({ eventType: 'fixed_income_purchase', assetId: 'sandpre', unitValue: 500 }),
    ]
    const sandboxAssetIds = new Set(['sandpre'])

    const snapshot = replay(events, new Map(), sandboxAssetIds)

    expect(snapshot.cash).toBe(10000 - 500)
    expect(snapshot.fixedIncomeValue).toBe(0)
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
  })
})
