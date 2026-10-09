import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IntegrityAlreadyRunningError } from '../../domain/errors'
import { sampleRun } from '../../test/fakes/fakeIntegrityAdmin'
import { createEngineIntegrityAdmin } from './engineIntegrityAdmin'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

const engine = () => createEngineIntegrityAdmin('http://engine:8080')

function respond(status: number, body: unknown) {
  fetchMock.mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body })
}

describe('engineIntegrityAdmin', () => {
  it('start chama POST /admin/integrity/check e devolve a verificação', async () => {
    respond(202, sampleRun)
    expect(await engine().start()).toEqual(sampleRun)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://engine:8080/admin/integrity/check')
    expect(init.method).toBe('POST')
  })

  it('start traduz 409 em IntegrityAlreadyRunningError', async () => {
    respond(409, { error: 'já existe uma verificação' })
    await expect(engine().start()).rejects.toBeInstanceOf(IntegrityAlreadyRunningError)
  })

  it('start com falha do motor lança erro genérico', async () => {
    respond(503, {})
    await expect(engine().start()).rejects.toThrow(/status 503/)
  })

  it('latest chama GET e devolve run, ou null', async () => {
    respond(200, { run: sampleRun })
    expect(await engine().latest()).toEqual(sampleRun)
    expect(fetchMock.mock.calls[0][0]).toBe('http://engine:8080/admin/integrity/check')
    respond(200, { run: null })
    expect(await engine().latest()).toBeNull()
  })

  it('latest com falha do motor lança erro', async () => {
    respond(500, {})
    await expect(engine().latest()).rejects.toThrow(/status 500/)
  })
})
