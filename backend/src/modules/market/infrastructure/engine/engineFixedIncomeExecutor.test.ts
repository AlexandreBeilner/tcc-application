import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEngineFixedIncomeExecutor } from './engineFixedIncomeExecutor'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

describe('engineFixedIncomeExecutor', () => {
  it('POST /fixed-income/purchases com o corpo repassado como JSON', async () => {
    const result = {
      unit_price: 950.2,
      quantity_purchased: 1.052,
      position: { quantity: 1.052, average_price: 950.2, average_rate: 0.11 },
    }
    fetchMock.mockResolvedValue({ ok: true, status: 201, json: async () => result })
    const executor = createEngineFixedIncomeExecutor('http://engine:8080')

    const input = { user_id: 'user-1', asset_id: 'asset-1', amount: 1000 }
    const response = await executor.purchase(input)

    expect(fetchMock).toHaveBeenCalledWith('http://engine:8080/fixed-income/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    expect(response).toEqual(result)
  })

  it('POST /fixed-income/redemptions com o corpo repassado como JSON', async () => {
    const result = {
      total_value: 1080,
      net_value: 1060,
      tax_rate: 0.175,
      mark_to_market: {
        mark_to_market_price: 1080,
        realized_return_pct: 0.08,
        vs_contracted_rate: -0.02,
      },
    }
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => result })
    const executor = createEngineFixedIncomeExecutor('http://engine:8080')

    const input = { user_id: 'user-1', asset_id: 'asset-1' }
    const response = await executor.redeem(input)

    expect(fetchMock).toHaveBeenCalledWith('http://engine:8080/fixed-income/redemptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    expect(response).toEqual(result)
  })

  it('GET /fixed-income/simulate com asset_id/amount/days_held na query string', async () => {
    const result = {
      unit_price: 798.27,
      quantity_purchased: 2.5,
      gross_projected_value: 2100,
      tax_rate: 0.2,
      net_projected_value: 2080,
    }
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => result })
    const executor = createEngineFixedIncomeExecutor('http://engine:8080')

    const input = { asset_id: 'asset-1', amount: 2000, days_held: 200 }
    const response = await executor.simulate(input)

    expect(fetchMock).toHaveBeenCalledWith(
      'http://engine:8080/fixed-income/simulate?asset_id=asset-1&amount=2000&days_held=200',
    )
    expect(response).toEqual(result)
  })

  it('traduz 404 (usuário sem posição) num EngineRequestError', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'usuário sem posição nesse título' }),
    })
    const executor = createEngineFixedIncomeExecutor('http://engine:8080')

    await expect(executor.redeem({ user_id: 'user-1', asset_id: 'asset-1' })).rejects.toMatchObject(
      { status: 404, message: 'usuário sem posição nesse título' },
    )
  })
})
