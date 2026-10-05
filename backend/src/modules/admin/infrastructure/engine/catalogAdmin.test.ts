import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CatalogAssetNotFoundError, CatalogAssetRejectedError } from '../../domain/errors'
import { sampleCatalogAsset } from '../../test/fakes/fakeCatalogAdmin'
import { createCatalogAdmin } from './catalogAdmin'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

const engine = () => createCatalogAdmin('http://engine:8080')

function respond(status: number, body: unknown) {
  fetchMock.mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body })
}

describe('catalogAdmin', () => {
  it('list chama GET /admin/catalog e devolve os ativos', async () => {
    respond(200, { assets: [sampleCatalogAsset] })
    expect(await engine().list()).toEqual([sampleCatalogAsset])
    expect(fetchMock.mock.calls[0][0]).toBe('http://engine:8080/admin/catalog')
  })

  it('update envia PATCH com o patch e o admin_id', async () => {
    respond(200, sampleCatalogAsset)
    await engine().update('asset-1', { name: 'Novo' }, 'admin-1')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://engine:8080/admin/catalog/asset-1')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({ name: 'Novo', admin_id: 'admin-1' })
  })

  it('traduz 404 e 422 do motor pra erros de domínio, com a mensagem dele', async () => {
    respond(404, { error: 'ativo não encontrado' })
    await expect(engine().update('x', { name: 'a' }, 'admin-1')).rejects.toThrow(
      CatalogAssetNotFoundError,
    )
    respond(422, { error: 'ativo do sandbox não é editável' })
    await expect(engine().update('x', { name: 'a' }, 'admin-1')).rejects.toThrow(
      'ativo do sandbox não é editável',
    )
    respond(422, {})
    await expect(engine().update('x', { name: 'a' }, 'admin-1')).rejects.toThrow(
      CatalogAssetRejectedError,
    )
  })

  it('falha inesperada vira erro genérico', async () => {
    respond(500, {})
    await expect(engine().list()).rejects.toThrow('status 500')
    await expect(engine().update('x', { name: 'a' }, 'admin-1')).rejects.toThrow('status 500')
  })
})
