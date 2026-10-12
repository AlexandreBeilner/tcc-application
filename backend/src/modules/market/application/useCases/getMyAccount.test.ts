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
          dividends_received: 8.5,
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
      assets: [
        {
          id: 'asset-1',
          ticker: 'PETR4',
          name: 'Petrobras',
          type: 'acao',
          is_sandbox: false,
          current_price: 31,
        },
      ],
      booksByAssetId: {
        'asset-1': {
          is_sandbox: false,
          price: null,
          best_bid: 32,
          best_ask: 32.5,
          mid_price: 32.25,
          bids: null,
          asks: null,
        },
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
          dividendsReceived: 8.5,
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
          dividends_received: 0,
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
        dividendsReceived: 0,
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
          dividends_received: 0,
        },
      ],
    })
    const catalogReader = createFakeCatalogReader({
      assets: [
        {
          id: 'asset-1',
          ticker: 'PETR4',
          name: 'Petrobras',
          type: 'acao',
          is_sandbox: false,
          current_price: 99,
        },
      ],
      booksByAssetId: {
        'asset-1': {
          is_sandbox: false,
          price: null,
          best_bid: 40,
          best_ask: null,
          mid_price: null,
          bids: null,
          asks: null,
        },
      },
    })
    const useCase = new GetMyAccountUseCase(accountReader, catalogReader)

    const result = await useCase.execute({ userId: 'user-4' })

    expect(result.positions[0].markPrice).toBe(99)
  })
  describe('valor atual da renda fixa (MO.8.1)', () => {
    const account = {
      user_id: 'u',
      current_balance: 1,
      total_invested: 1,
      total_dividends_received: 0,
    }
    const base = { type: 'cdb', quantity: 1, average_price: 1000, average_rate: 1.1 }

    it('pede a avaliação ao motor e repassa currentValue/netValue das posições reais', async () => {
      const accountReader = createFakeAccountReader({
        account,
        fixedIncomePositions: [
          {
            ...base,
            asset_id: 'a1',
            ticker: 'CDB1',
            name: 'CDB 1',
            is_sandbox: false,
            current_value: 1100.5,
            net_value: 1085,
          },
        ],
      })
      const result = await new GetMyAccountUseCase(
        accountReader,
        createFakeCatalogReader({}),
      ).execute({ userId: 'u' })

      expect(accountReader.listFixedIncomePositionsOptions).toEqual([{ valuation: true }])
      expect(result.fixedIncomePositions[0]).toMatchObject({ currentValue: 1100.5, netValue: 1085 })
    })

    it('avaliação que falhou no motor (campos ausentes) deixa os campos fora, sem derrubar a rota', async () => {
      const accountReader = createFakeAccountReader({
        account,
        fixedIncomePositions: [
          {
            ...base,
            asset_id: 'a1',
            ticker: 'CDB1',
            name: 'CDB 1',
            is_sandbox: false,
            current_value: 1100,
            net_value: 1090,
          },
          { ...base, asset_id: 'a2', ticker: 'CDB2', name: 'CDB 2', is_sandbox: false },
        ],
      })
      const result = await new GetMyAccountUseCase(
        accountReader,
        createFakeCatalogReader({}),
      ).execute({ userId: 'u' })

      expect(result.fixedIncomePositions[0].currentValue).toBe(1100)
      expect(result.fixedIncomePositions[1].currentValue).toBeUndefined()
      expect(result.fixedIncomePositions[1].netValue).toBeUndefined()
    })

    it('sandbox nunca leva valor atual, mesmo que o motor mande', async () => {
      const accountReader = createFakeAccountReader({
        account,
        fixedIncomePositions: [
          {
            ...base,
            asset_id: 'a3',
            ticker: 'SBX',
            name: 'Sandbox',
            is_sandbox: true,
            current_value: 5,
            net_value: 5,
          },
        ],
      })
      const result = await new GetMyAccountUseCase(
        accountReader,
        createFakeCatalogReader({}),
      ).execute({ userId: 'u' })

      expect(result.fixedIncomePositions[0].currentValue).toBeUndefined()
      expect(result.fixedIncomePositions[0].netValue).toBeUndefined()
    })
  })
})
