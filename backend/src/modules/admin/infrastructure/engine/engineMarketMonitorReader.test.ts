import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminAssetNotFoundError } from '../../domain/errors'
import { sampleMonitorAsset, sampleMonitorDetail } from '../../test/fakes/fakeMarketMonitorReader'
import { createEngineMarketMonitorReader } from './engineMarketMonitorReader'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

const engine = () => createEngineMarketMonitorReader('http://engine:8080')

function respond(status: number, body: unknown) {
  fetchMock.mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body })
}

describe('engineMarketMonitorReader', () => {
  it('listAssets chama GET /admin/market/assets e devolve o array', async () => {
    respond(200, { assets: [sampleMonitorAsset] })
    expect(await engine().listAssets()).toEqual([sampleMonitorAsset])
    expect(fetchMock.mock.calls[0][0]).toBe('http://engine:8080/admin/market/assets')
  })

  it('getAsset chama o detalhe do ativo', async () => {
    respond(200, sampleMonitorDetail)
    expect(await engine().getAsset(sampleMonitorAsset.asset_id)).toEqual(sampleMonitorDetail)
    expect(fetchMock.mock.calls[0][0]).toBe(
      `http://engine:8080/admin/market/assets/${sampleMonitorAsset.asset_id}`,
    )
  })

  it('traduz o 404 do motor em AdminAssetNotFoundError', async () => {
    respond(404, { error: 'ativo não encontrado' })
    await expect(engine().getAsset('x')).rejects.toBeInstanceOf(AdminAssetNotFoundError)
  })

  it('qualquer outro erro do motor vira falha com o status', async () => {
    respond(500, {})
    await expect(engine().listAssets()).rejects.toThrow('status 500')
    await expect(engine().getAsset('x')).rejects.toThrow('status 500')
  })
})
