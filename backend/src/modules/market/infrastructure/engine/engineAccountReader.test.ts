import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEngineAccountReader } from './engineAccountReader'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

describe('engineAccountReader', () => {
  it('GET /accounts/:userId', async () => {
    const account = {
      user_id: 'user-1',
      current_balance: 10000,
      total_invested: 0,
      total_dividends_received: 0,
    }
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => account })
    const reader = createEngineAccountReader('http://engine:8080')

    const result = await reader.getAccount('user-1')

    expect(fetchMock).toHaveBeenCalledWith('http://engine:8080/accounts/user-1')
    expect(result).toEqual(account)
  })

  it('GET /positions?user_id=', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => [] })
    const reader = createEngineAccountReader('http://engine:8080')

    await reader.listPositions('user-1')

    expect(fetchMock).toHaveBeenCalledWith('http://engine:8080/positions?user_id=user-1')
  })

  it('GET /fixed-income/positions?user_id=', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => [] })
    const reader = createEngineAccountReader('http://engine:8080')

    await reader.listFixedIncomePositions('user-1')

    expect(fetchMock).toHaveBeenCalledWith(
      'http://engine:8080/fixed-income/positions?user_id=user-1',
    )
  })

  it('GET /accounts/:userId/events sem query string quando limit/offset ausentes', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => [] })
    const reader = createEngineAccountReader('http://engine:8080')

    await reader.listAccountEvents('user-1', {})

    expect(fetchMock).toHaveBeenCalledWith('http://engine:8080/accounts/user-1/events')
  })

  it('GET /accounts/:userId/events repassa limit/offset como query string', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => [] })
    const reader = createEngineAccountReader('http://engine:8080')

    await reader.listAccountEvents('user-1', { limit: 20, offset: 40 })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://engine:8080/accounts/user-1/events?limit=20&offset=40',
    )
  })

  it('traduz erro do motor num EngineRequestError', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'nenhuma conta com esse user_id' }),
    })
    const reader = createEngineAccountReader('http://engine:8080')

    await expect(reader.getAccount('sem-conta')).rejects.toMatchObject({
      status: 404,
      message: 'nenhuma conta com esse user_id',
    })
  })
})
