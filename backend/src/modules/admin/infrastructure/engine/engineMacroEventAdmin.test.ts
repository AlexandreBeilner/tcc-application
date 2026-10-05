import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MacroEventConflictError, MacroEventNotFoundError } from '../../domain/errors'
import { sampleDetail } from '../../test/fakes/fakeMacroEventAdmin'
import { createEngineMacroEventAdmin } from './engineMacroEventAdmin'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

const engine = () => createEngineMacroEventAdmin('http://engine:8080')

function respond(status: number, body: unknown) {
  fetchMock.mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body })
}

describe('engineMacroEventAdmin', () => {
  it('detail chama GET /macro-events/:id com a janela', async () => {
    respond(200, sampleDetail)
    expect(await engine().detail('event-1', 7)).toEqual(sampleDetail)
    expect(fetchMock.mock.calls[0][0]).toBe('http://engine:8080/macro-events/event-1?window_days=7')
  })

  it('detail sem janela não manda query', async () => {
    respond(200, sampleDetail)
    await engine().detail('event-1')
    expect(fetchMock.mock.calls[0][0]).toBe('http://engine:8080/macro-events/event-1')
  })

  it('cancel envia DELETE', async () => {
    respond(200, { ...sampleDetail, status: 'cancelado' })
    await engine().cancel('event-1')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://engine:8080/macro-events/event-1')
    expect(init.method).toBe('DELETE')
  })

  it('traduz 404 e 409 do motor em erros de domínio com a mensagem dele', async () => {
    respond(404, { error: 'evento macro não encontrado' })
    await expect(engine().detail('x')).rejects.toThrow(MacroEventNotFoundError)
    respond(409, { error: 'o evento já começou a produzir efeito e não pode mais ser cancelado' })
    await expect(engine().cancel('x')).rejects.toThrow(
      'o evento já começou a produzir efeito e não pode mais ser cancelado',
    )
    respond(409, { error: 'x' })
    await expect(engine().cancel('x')).rejects.toThrow(MacroEventConflictError)
  })

  it('outro status de erro vira erro genérico', async () => {
    respond(500, {})
    await expect(engine().detail('x')).rejects.toThrow('status 500')
  })
})
