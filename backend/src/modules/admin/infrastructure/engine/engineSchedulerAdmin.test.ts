import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SchedulerDisabledError,
  TickAdvanceFailedError,
  TickInProgressError,
} from '../../domain/errors'
import { sampleStatus } from '../../test/fakes/fakeSchedulerAdmin'
import { createEngineSchedulerAdmin } from './engineSchedulerAdmin'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

const engine = () => createEngineSchedulerAdmin('http://engine:8080')

function respond(status: number, body: unknown) {
  fetchMock.mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body })
}

describe('engineSchedulerAdmin', () => {
  it('getStatus chama GET /admin/scheduler', async () => {
    respond(200, sampleStatus)
    expect(await engine().getStatus()).toEqual(sampleStatus)
    expect(fetchMock).toHaveBeenCalledWith('http://engine:8080/admin/scheduler', {})
  })

  it('pause e resume chamam POST nas rotas certas', async () => {
    respond(200, sampleStatus)
    await engine().pause()
    await engine().resume()
    expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://engine:8080/admin/scheduler/pause', {
      method: 'POST',
    })
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'http://engine:8080/admin/scheduler/resume', {
      method: 'POST',
    })
  })

  it('traduz 409 de pause/resume em SchedulerDisabledError', async () => {
    respond(409, { error: 'a agenda automática está desligada neste ambiente' })
    await expect(engine().pause()).rejects.toThrow(SchedulerDisabledError)
  })

  it('erro inesperado do motor vira Error genérico com o status', async () => {
    respond(500, {})
    await expect(engine().getStatus()).rejects.toThrow(/status 500/)
  })

  it('listTicks monta a query só com o que veio', async () => {
    respond(200, { ticks: [], total_entries: 0 })
    await engine().listTicks({ limit: 5, offset: 10 })
    await engine().listTicks({})
    expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://engine:8080/admin/ticks?limit=5&offset=10')
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'http://engine:8080/admin/ticks')
  })

  it('listTicks propaga falha do motor', async () => {
    respond(503, {})
    await expect(engine().listTicks({})).rejects.toThrow(/status 503/)
  })

  it('advance envia { days } em JSON e devolve o resultado', async () => {
    respond(200, { requested: 2, ticks: [{ day: 1 }, { day: 2 }] })
    const result = await engine().advance(2)
    expect(result.ticks).toHaveLength(2)
    expect(fetchMock).toHaveBeenCalledWith('http://engine:8080/admin/tick/advance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days: 2 }),
    })
  })

  it('advance traduz 409 em TickInProgressError', async () => {
    respond(409, { error: 'já existe um tick em andamento' })
    await expect(engine().advance(2)).rejects.toThrow(TickInProgressError)
  })

  it('advance traduz 500 com ticks em TickAdvanceFailedError carregando o que já rodou', async () => {
    respond(500, { error: 'erro ao executar tick', requested: 5, ticks: [{ day: 7 }] })
    const err = await engine()
      .advance(5)
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(TickAdvanceFailedError)
    expect((err as TickAdvanceFailedError).completedTicks).toEqual([{ day: 7 }])
    expect((err as Error).message).toContain('erro ao executar tick')
  })

  it('advance com 500 sem corpo ainda vira TickAdvanceFailedError sem ticks', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('sem corpo')
      },
    })
    const err = await engine()
      .advance(2)
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(TickAdvanceFailedError)
    expect((err as TickAdvanceFailedError).completedTicks).toEqual([])
  })

  it('advance com outro status de erro vira Error genérico', async () => {
    respond(503, {})
    await expect(engine().advance(2)).rejects.toThrow(/status 503/)
  })
})
