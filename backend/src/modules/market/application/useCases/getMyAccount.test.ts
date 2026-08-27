import { describe, expect, it } from 'vitest'
import { createFakeAccountReader } from '../../test/fakes/fakeAccountReader'
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
    const useCase = new GetMyAccountUseCase(accountReader)

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
  })

  it('devolve arrays vazios pra usuário sem nenhuma posição', async () => {
    const accountReader = createFakeAccountReader({
      account: {
        user_id: 'user-2',
        current_balance: 10000,
        total_invested: 0,
        total_dividends_received: 0,
      },
    })
    const useCase = new GetMyAccountUseCase(accountReader)

    const result = await useCase.execute({ userId: 'user-2' })

    expect(result.positions).toEqual([])
    expect(result.fixedIncomePositions).toEqual([])
  })
})
