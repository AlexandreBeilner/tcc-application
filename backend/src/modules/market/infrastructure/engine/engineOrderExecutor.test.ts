import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEngineOrderExecutor } from './engineOrderExecutor'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

describe('engineOrderExecutor', () => {
  it('POST /orders com o corpo repassado como JSON', async () => {
    const result = { filled_quantity: 10, remaining_quantity: 0, fills: [] }
    fetchMock.mockResolvedValue({ ok: true, status: 201, json: async () => result })
    const executor = createEngineOrderExecutor('http://engine:8080')

    const input = {
      user_id: 'user-1',
      asset_id: 'asset-1',
      side: 'buy' as const,
      type: 'market' as const,
      quantity: 10,
    }
    const response = await executor.submit(input)

    expect(fetchMock).toHaveBeenCalledWith('http://engine:8080/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    expect(response).toEqual(result)
  })

  it('traduz 422 (saldo insuficiente) num EngineRequestError', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ error: 'saldo insuficiente' }),
    })
    const executor = createEngineOrderExecutor('http://engine:8080')

    await expect(
      executor.submit({
        user_id: 'user-1',
        asset_id: 'asset-1',
        side: 'buy',
        type: 'market',
        quantity: 999999,
      }),
    ).rejects.toMatchObject({ status: 422, message: 'saldo insuficiente' })
  })
})
