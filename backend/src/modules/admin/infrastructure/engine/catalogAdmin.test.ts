import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CatalogAssetConflictError,
  CatalogAssetNotFoundError,
  CatalogAssetPartialError,
  CatalogAssetRejectedError,
} from '../../domain/errors'
import { sampleCatalogAsset, samplePreview } from '../../test/fakes/fakeCatalogAdmin'
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

  describe('cadastro de ativo novo (N.13)', () => {
    const asset = { kind: 'fii_papel', ticker: 'NOVP11', name: 'Fii', indexador: 'CDI' } as const

    it('preview envia POST /admin/catalog/preview sem admin_id', async () => {
      respond(200, samplePreview)
      expect(await engine().preview(asset)).toEqual(samplePreview)
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('http://engine:8080/admin/catalog/preview')
      expect(init.method).toBe('POST')
      expect(JSON.parse(init.body)).toEqual(asset)
    })

    it('create envia POST /admin/catalog com o admin_id', async () => {
      respond(201, { asset_id: 'a1', preview: samplePreview })
      expect((await engine().create(asset, 'admin-1')).asset_id).toBe('a1')
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('http://engine:8080/admin/catalog')
      expect(JSON.parse(init.body)).toEqual({ ...asset, admin_id: 'admin-1' })
    })

    it('traduz 409, 422 (com o campo) e 500 com asset_id', async () => {
      respond(409, { error: 'ticker em uso' })
      await expect(engine().create(asset, 'a')).rejects.toThrow(CatalogAssetConflictError)

      respond(422, { error: 'CNPJ deve ter 14 dígitos', field: 'cnpj' })
      await expect(engine().preview(asset)).rejects.toMatchObject({
        message: 'CNPJ deve ter 14 dígitos',
        field: 'cnpj',
      })

      respond(500, { error: 'cobertura falhou', asset_id: 'a1' })
      await expect(engine().create(asset, 'a')).rejects.toMatchObject({
        assetId: 'a1',
        message: 'cobertura falhou',
      })
      await expect(engine().create(asset, 'a')).rejects.toThrow(CatalogAssetPartialError)
    })

    it('500 sem asset_id vira erro genérico', async () => {
      respond(500, { error: 'banco fora' })
      await expect(engine().create(asset, 'a')).rejects.toThrow('status 500')
    })
  })
})
