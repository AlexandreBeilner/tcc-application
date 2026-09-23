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
    const result = { order_id: 'order-1', filled_quantity: 10, remaining_quantity: 0, fills: [] }
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

  it('POST /orders/:id/cancel com user_id no corpo (tarefa O.1)', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204, json: async () => ({}) })
    const executor = createEngineOrderExecutor('http://engine:8080')

    const response = await executor.cancel('order-1', 'user-1')

    expect(fetchMock).toHaveBeenCalledWith('http://engine:8080/orders/order-1/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: 'user-1' }),
    })
    expect(response).toBeUndefined()
  })

  it('traduz 404 (ordem não encontrada ou de outro usuário) num EngineRequestError', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'ordem não encontrada' }),
    })
    const executor = createEngineOrderExecutor('http://engine:8080')

    await expect(executor.cancel('order-1', 'user-1')).rejects.toMatchObject({
      status: 404,
      message: 'ordem não encontrada',
    })
  })

  it('traduz 409 (ordem já filled/cancelled) num EngineRequestError', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: 'ordem não pode ser cancelada neste status' }),
    })
    const executor = createEngineOrderExecutor('http://engine:8080')

    await expect(executor.cancel('order-1', 'user-1')).rejects.toMatchObject({ status: 409 })
  })

  it('GET /orders?user_id= (tarefa O.3)', async () => {
    const records = [
      {
        order_id: 'order-1',
        asset_id: 'asset-1',
        side: 'buy',
        type: 'market',
        quantity: 10,
        filled_quantity: 10,
        price: 25,
        status: 'filled',
        created_at: '2026-01-01T00:00:00Z',
      },
    ]
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => records })
    const executor = createEngineOrderExecutor('http://engine:8080')

    const response = await executor.list('user-1')

    expect(fetchMock).toHaveBeenCalledWith('http://engine:8080/orders?user_id=user-1')
    expect(response).toEqual(records)
  })
})
