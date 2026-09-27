import { describe, expect, it } from 'vitest'
import { createFakeAccountReader } from '../../test/fakes/fakeAccountReader'
import { createFakeCatalogReader } from '../../test/fakes/fakeCatalogReader'
import { GetMyAccountUseCase } from './getMyAccount'

describe('GetMyAccountUseCase', () => {
  it('agrega conta + posições de renda variável e fixa numa única resposta camelCase', async () => {
    const accountReader = createFakeAccountReader({
      account: {
        user_id: 'user-1',
        current_balance: 8500.5,
        total_invested: 1500,
        total_dividends_received: 12.3,
      },
      positions: [
        {
          asset_id: 'asset-1',
          ticker: 'PETR4',
          name: 'Petrobras',
          type: 'acao',
          is_sandbox: false,
          quantity: 10,
          average_price: 30,
        },
      ],
      fixedIncomePositions: [
        {
          asset_id: 'asset-2',
          ticker: 'CDB-XP',
          name: 'CDB XP',
          type: 'cdb',
          is_sandbox: true,
          quantity: 100,
          average_price: 1,
          average_rate: 0.12,
        },
      ],
    })
    const catalogReader = createFakeCatalogReader({
      assets: [{ id: 'asset-1', ticker: 'PETR4', name: 'Petrobras', type: 'acao', is_sandbox: false, current_price: 31 }],
      booksByAssetId: {
        'asset-1': { is_sandbox: false, price: null, best_bid: 32, best_ask: 32.5, mid_price: 32.25, bids: null, asks: null },
      },
    })
    const useCase = new GetMyAccountUseCase(accountReader, catalogReader)

    const result = await useCase.execute({ userId: 'user-1' })

    expect(result).toEqual({
      cashBalance: 8500.5,
      totalInvested: 1500,
      totalDividendsReceived: 12.3,
      positions: [
        {
          assetId: 'asset-1',
          ticker: 'PETR4',
          name: 'Petrobras',
          type: 'acao',
          isSandbox: false,
          quantity: 10,
          averagePrice: 30,
          markPrice: 32.25,
        },
      ],
      fixedIncomePositions: [
        {
          assetId: 'asset-2',
          ticker: 'CDB-XP',
          name: 'CDB XP',
          type: 'cdb',
          isSandbox: true,
          quantity: 100,
          averagePrice: 1,
          averageRate: 0.12,
        },
      ],
    })
    expect(accountReader.getAccountCalls).toEqual(['user-1'])
    expect(accountReader.listPositionsCalls).toEqual(['user-1'])
    expect(accountReader.listFixedIncomePositionsCalls).toEqual(['user-1'])
    expect(catalogReader.getAssetBookCalls).toEqual([{ id: 'asset-1', userId: 'user-1' }])
  })

  it('devolve arrays vazios pra usuário sem nenhuma posição, sem chamar o book', async () => {
    const accountReader = createFakeAccountReader({
      account: {
        user_id: 'user-2',
        current_balance: 10000,
        total_invested: 0,
        total_dividends_received: 0,
      },
    })
    const catalogReader = createFakeCatalogReader({})
    const useCase = new GetMyAccountUseCase(accountReader, catalogReader)

    const result = await useCase.execute({ userId: 'user-2' })

    expect(result.positions).toEqual([])
    expect(result.fixedIncomePositions).toEqual([])
    expect(catalogReader.getAssetBookCalls).toEqual([])
  })

  it('posição sandbox nunca ganha markPrice (nunca teve book real)', async () => {
    const accountReader = createFakeAccountReader({
      account: {
        user_id: 'user-3',
        current_balance: 10000,
        total_invested: 0,
        total_dividends_received: 0,
      },
      positions: [
        {
          asset_id: 'sand-1',
          ticker: 'SAND3',
          name: 'Sandbox',
          type: 'acao',
          is_sandbox: true,
          quantity: 5,
          average_price: 100,
        },
      ],
    })
    const catalogReader = createFakeCatalogReader({})
    const useCase = new GetMyAccountUseCase(accountReader, catalogReader)

    const result = await useCase.execute({ userId: 'user-3' })

    expect(result.positions).toEqual([
      {
        assetId: 'sand-1',
        ticker: 'SAND3',
        name: 'Sandbox',
        type: 'acao',
        isSandbox: true,
        quantity: 5,
        averagePrice: 100,
        markPrice: undefined,
      },
    ])
    expect(catalogReader.getAssetBookCalls).toEqual([])
  })

  it('sem os dois lados do book, cai pro último preço negociado (fallback) — um negócio de 1 cota não move a marcação além do ponto médio quando o book tem os dois lados', async () => {
    const accountReader = createFakeAccountReader({
      account: {
        user_id: 'user-4',
        current_balance: 10000,
        total_invested: 0,
        total_dividends_received: 0,
      },
      positions: [
        {
          asset_id: 'asset-1',
          ticker: 'PETR4',
          name: 'Petrobras',
          type: 'acao',
          is_sandbox: false,
          quantity: 10,
          average_price: 30,
        },
      ],
    })
    const catalogReader = createFakeCatalogReader({
      assets: [{ id: 'asset-1', ticker: 'PETR4', name: 'Petrobras', type: 'acao', is_sandbox: false, current_price: 99 }],
      booksByAssetId: {
        'asset-1': { is_sandbox: false, price: null, best_bid: 40, best_ask: null, mid_price: null, bids: null, asks: null },
      },
    })
    const useCase = new GetMyAccountUseCase(accountReader, catalogReader)

    const result = await useCase.execute({ userId: 'user-4' })

    expect(result.positions[0].markPrice).toBe(99)
  })
})
