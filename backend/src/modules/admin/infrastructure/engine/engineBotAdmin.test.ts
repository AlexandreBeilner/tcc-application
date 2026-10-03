import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BatchTooLargeError,
  BotConflictError,
  BotNotFoundError,
  BotRejectedError,
} from '../../domain/errors'
import { sampleBot } from '../../test/fakes/fakeBotAdmin'
import { createEngineBotAdmin } from './engineBotAdmin'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

const engine = () => createEngineBotAdmin('http://engine:8080')

function respond(status: number, body: unknown) {
  fetchMock.mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body })
}

describe('engineBotAdmin', () => {
  it('list chama GET /admin/bots', async () => {
    respond(200, { bots: [sampleBot], uncovered_assets: [] })
    expect((await engine().list()).bots).toEqual([sampleBot])
    expect(fetchMock.mock.calls[0][0]).toBe('http://engine:8080/admin/bots')
  })

  it('create traduz o input pra snake_case do motor', async () => {
    respond(201, sampleBot)
    await engine().create({
      archetype: 'fundamentalista',
      sectors: ['Varejo'],
      riskClasses: ['Conservador'],
      assetClasses: [],
      withinScopePct: 0.88,
      knowledgeLevel: 0.7,
      maxPositionSizePct: 0.3,
      marketOrderPreference: 0.4,
      spreadWidthPct: 0.01,
      initialCash: 5000,
    })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://engine:8080/admin/bots')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({
      archetype: 'fundamentalista',
      sectors: ['Varejo'],
      risk_classes: ['Conservador'],
      asset_classes: [],
      within_scope_pct: 0.88,
      knowledge_level: 0.7,
      max_position_size_pct: 0.3,
      market_order_preference: 0.4,
      spread_width_pct: 0.01,
      initial_cash: 5000,
    })
  })

  it('update chama PATCH /admin/bots/:id só com os campos informados', async () => {
    respond(200, sampleBot)
    await engine().update('bot-1', { isActive: false, coveredAssetIds: [] })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://engine:8080/admin/bots/bot-1')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({ is_active: false, covered_asset_ids: [] })
  })

  it.each([
    [400, BotRejectedError],
    [404, BotNotFoundError],
    [409, BotConflictError],
  ])('traduz o status %i do motor pro erro de domínio', async (status, errorClass) => {
    respond(status, { error: 'recusado' })
    await expect(engine().update('bot-1', { isActive: true })).rejects.toThrow(errorClass)
  })

  it('traduz o 422 do cancelamento de ordens do Market Maker com a contagem', async () => {
    respond(422, { error: 'filtro grande', code: 'batch_too_large', matched: 600, max: 500 })
    const err = await engine()
      .update('bot-1', { coveredAssetIds: [] })
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(BatchTooLargeError)
    expect(err).toMatchObject({ matched: 600, max: 500 })
  })

  it('falha inesperada do motor vira erro genérico', async () => {
    respond(500, {})
    await expect(engine().list()).rejects.toThrow('status 500')
  })
})
