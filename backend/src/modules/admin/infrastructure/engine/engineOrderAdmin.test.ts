import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AdminOrderNotCancellableError,
  AdminOrderNotFoundError,
  BatchTooLargeError,
} from '../../domain/errors'
import { sampleAdminOrder } from '../../test/fakes/fakeOrderAdmin'
import { createEngineOrderAdmin } from './engineOrderAdmin'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

const engine = () => createEngineOrderAdmin('http://engine:8080')

function respond(status: number, body: unknown) {
  fetchMock.mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })
}

describe('engineOrderAdmin', () => {
  it('list repassa só os filtros definidos na query string', async () => {
    respond(200, { orders: [sampleAdminOrder], total: 1 })

    const result = await engine().list({ status: 'open', limit: 10, side: undefined })

    expect(result.total).toBe(1)
    expect(fetchMock.mock.calls[0][0]).toBe('http://engine:8080/admin/orders?status=open&limit=10')
  })

  it('list sem filtros chama a rota sem query string', async () => {
    respond(200, { orders: [], total: 0 })
    await engine().list({})
    expect(fetchMock.mock.calls[0][0]).toBe('http://engine:8080/admin/orders')
  })

  it('cancel chama POST /admin/orders/:id/cancel', async () => {
    respond(204, undefined)
    await engine().cancel('ord-1')
    expect(fetchMock.mock.calls[0][0]).toBe('http://engine:8080/admin/orders/ord-1/cancel')
    expect(fetchMock.mock.calls[0][1].method).toBe('POST')
  })

  it('cancel traduz 404 e 409 para erros de domínio', async () => {
    respond(404, { error: 'ordem não encontrada' })
    await expect(engine().cancel('x')).rejects.toThrow(AdminOrderNotFoundError)
    respond(409, { error: 'ordem não pode ser cancelada neste status' })
    await expect(engine().cancel('x')).rejects.toThrow(AdminOrderNotCancellableError)
  })

  it('cancelBatch envia os filtros e devolve a lista cancelada', async () => {
    respond(200, { cancelled_count: 1, cancelled_ids: ['a'] })

    const result = await engine().cancelBatch({ assetId: 'asset-1' })

    expect(result.cancelled_ids).toEqual(['a'])
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://engine:8080/admin/orders/cancel-batch')
    expect(JSON.parse(init.body)).toEqual({ asset_id: 'asset-1' })
  })

  it('cancelBatch traduz 422 batch_too_large com a contagem', async () => {
    respond(422, {
      error: 'o filtro atinge 501 ordens',
      code: 'batch_too_large',
      matched: 501,
      max: 500,
    })
    await expect(engine().cancelBatch({ userId: 'u' })).rejects.toMatchObject({
      name: 'Error',
      matched: 501,
      max: 500,
    })
    await expect(engine().cancelBatch({ userId: 'u' })).rejects.toBeInstanceOf(BatchTooLargeError)
  })

  it('falha inesperada do motor vira Error genérico', async () => {
    respond(500, {})
    await expect(engine().cancelBatch({ userId: 'u' })).rejects.toThrow('status 500')
  })
})
