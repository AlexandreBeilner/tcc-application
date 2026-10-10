import { describe, expect, it } from 'vitest'
import type { MarketEventRecord } from '../../domain/networth'
import { createFakeAccountEventsReader } from '../../test/fakes/fakeAccountEventsReader'
import { createFakeAssetPriceHistoryReader } from '../../test/fakes/fakeAssetPriceHistoryReader'
import { createFakeCurrentAccountStateReader } from '../../test/fakes/fakeCurrentAccountStateReader'
import { GetNetWorthUseCase } from './getNetWorth'

function event(
  partial: Partial<MarketEventRecord> & Pick<MarketEventRecord, 'eventType'>,
): MarketEventRecord {
  return { id: crypto.randomUUID(), timestamp: new Date('2026-01-01T00:00:00Z'), ...partial }
}

describe('GetNetWorthUseCase', () => {
  it('asOf omitido usa o estado já projetado (caminho rápido), sem tocar o extrato', async () => {
    const accountEventsReader = createFakeAccountEventsReader({
      u1: [event({ eventType: 'initial_deposit', unitValue: 10000 })],
    })
    const currentAccountStateReader = createFakeCurrentAccountStateReader({
      u1: {
        cash: 5000,
        variableIncomeValue: 6000,
        fixedIncomeValue: 0,
        tradesExecuted: 0,
        total: 11000,
        investedCost: 0,
        disinvestedProceeds: 0,
        dividendsReceived: 0,
      },
    })
    const useCase = new GetNetWorthUseCase(
      accountEventsReader,
      createFakeAssetPriceHistoryReader(),
      currentAccountStateReader,
    )

    const snapshot = await useCase.execute({ userId: 'u1', sandboxAssetIds: new Set() })

    expect(snapshot.total).toBe(11000)
  })

  it('asOf no passado reconstrói por replay, ignorando eventos depois do cutoff', async () => {
    const events = [
      event({
        eventType: 'initial_deposit',
        unitValue: 10000,
        timestamp: new Date('2026-08-01T00:00:00Z'),
      }),
      event({
        eventType: 'buy_order_executed',
        assetId: 'a1',
        quantity: 10,
        unitValue: 50,
        timestamp: new Date('2026-08-10T00:00:00Z'),
      }),
      event({
        eventType: 'buy_order_executed',
        assetId: 'a1',
        quantity: 5,
        unitValue: 60,
        timestamp: new Date('2026-08-20T00:00:00Z'),
      }),
    ]
    const accountEventsReader = createFakeAccountEventsReader({ u1: events })
    const assetPriceHistoryReader = createFakeAssetPriceHistoryReader({ a1: 55 })
    const useCase = new GetNetWorthUseCase(
      accountEventsReader,
      assetPriceHistoryReader,
      createFakeCurrentAccountStateReader(),
    )

    const snapshot = await useCase.execute({
      userId: 'u1',
      asOf: new Date('2026-08-15T00:00:00Z'), // exclui a segunda compra
      sandboxAssetIds: new Set(),
    })

    expect(snapshot.cash).toBe(10000 - 10 * 50)
    expect(snapshot.variableIncomeValue).toBe(10 * 55)
  })

  it('não pede cotação pra ativos de renda fixa nem sandbox (só variável, fora do sandbox)', async () => {
    const events = [
      event({
        eventType: 'initial_deposit',
        unitValue: 10000,
        timestamp: new Date('2026-08-01T00:00:00Z'),
      }),
      event({
        eventType: 'fixed_income_purchase',
        assetId: 'ri1',
        unitValue: 1000,
        timestamp: new Date('2026-08-02T00:00:00Z'),
      }),
      event({
        eventType: 'buy_order_executed',
        assetId: 'sand1',
        quantity: 3,
        unitValue: 100,
        timestamp: new Date('2026-08-03T00:00:00Z'),
      }),
    ]
    let priceAsOfCalls = 0
    const assetPriceHistoryReader = {
      async priceAsOf() {
        priceAsOfCalls += 1
        return 0
      },
    }
    const useCase = new GetNetWorthUseCase(
      createFakeAccountEventsReader({ u1: events }),
      assetPriceHistoryReader,
      createFakeCurrentAccountStateReader(),
    )

    await useCase.execute({
      userId: 'u1',
      asOf: new Date('2026-08-31T00:00:00Z'),
      sandboxAssetIds: new Set(['sand1']),
    })

    expect(priceAsOfCalls).toBe(0)
  })

  it('asOf ligeiramente anterior ao primeiro evento ainda inclui o capital inicial (RNF06) — não zera a baseline', async () => {
    // Reproduz o cenário real encontrado via docker compose: users.created_at
    // (banco gamification) pode ser alguns milissegundos anterior ao
    // initial_deposit gravado pelo motor (o provisionamento da conta é um
    // round-trip HTTP separado, depois do INSERT em `users`). Sem o clamp
    // pro primeiro evento, isso zerava a baseline em vez de refletir RNF06.
    const initialDepositAt = new Date('2026-08-25T00:01:33.769Z')
    const events = [
      event({ eventType: 'initial_deposit', unitValue: 10000, timestamp: initialDepositAt }),
    ]
    const useCase = new GetNetWorthUseCase(
      createFakeAccountEventsReader({ u1: events }),
      createFakeAssetPriceHistoryReader(),
      createFakeCurrentAccountStateReader(),
    )

    const snapshot = await useCase.execute({
      userId: 'u1',
      asOf: new Date(initialDepositAt.getTime() - 50), // 50ms antes do 1º evento
      sandboxAssetIds: new Set(),
    })

    expect(snapshot.total).toBe(10000)
  })
})
