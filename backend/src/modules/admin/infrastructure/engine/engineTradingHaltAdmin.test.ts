import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  TradingHaltConflictError,
  TradingHaltNotFoundError,
  TradingHaltRejectedError,
} from '../../domain/errors'
import { sampleHalt } from '../../test/fakes/fakeTradingHaltAdmin'
import { createEngineTradingHaltAdmin } from './engineTradingHaltAdmin'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

const engine = () => createEngineTradingHaltAdmin('http://engine:8080')

function respond(status: number, body: unknown) {
  fetchMock.mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body })
}

describe('engineTradingHaltAdmin', () => {
  it('list chama GET /admin/halts', async () => {
    respond(200, { active: [sampleHalt], recent: [] })
    expect((await engine().list()).active).toEqual([sampleHalt])
    expect(fetchMock.mock.calls[0][0]).toBe('http://engine:8080/admin/halts')
  })

  it('pause envia escopo, ativo, motivo e o admin_id', async () => {
    respond(201, sampleHalt)
    await engine().pause({ scope: 'asset', assetId: 'asset-1', reason: 'm' }, 'admin-1')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://engine:8080/admin/halts')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({
      scope: 'asset',
      asset_id: 'asset-1',
      reason: 'm',
      admin_id: 'admin-1',
    })
  })

  it('lift chama POST /admin/halts/:id/lift com o admin_id', async () => {
    respond(200, sampleHalt)
    await engine().lift('halt-1', 'admin-2')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://engine:8080/admin/halts/halt-1/lift')
    expect(JSON.parse(init.body)).toEqual({ admin_id: 'admin-2' })
  })

  it.each([
    [400, TradingHaltRejectedError],
    [404, TradingHaltNotFoundError],
    [409, TradingHaltConflictError],
  ])('traduz o status %i do motor para erro de domínio', async (status, ErrorClass) => {
    respond(status, { error: 'recusado' })
    await expect(engine().pause({ scope: 'global', reason: 'm' }, 'a')).rejects.toBeInstanceOf(
      ErrorClass,
    )
    await expect(engine().lift('h', 'a')).rejects.toBeInstanceOf(ErrorClass)
  })

  it('falha inesperada vira Error genérico', async () => {
    respond(500, {})
    await expect(engine().lift('h', 'a')).rejects.toThrow('status 500')
  })
})
