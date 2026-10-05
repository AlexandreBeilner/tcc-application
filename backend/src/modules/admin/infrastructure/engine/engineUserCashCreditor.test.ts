import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AdminUserNotFoundError,
  CashCreditOverflowError,
  CashCreditRejectedError,
} from '../../domain/errors'
import { createEngineUserCashCreditor } from './engineUserCashCreditor'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

const engine = () => createEngineUserCashCreditor('http://engine:8080')

function respond(status: number, body: unknown) {
  fetchMock.mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body })
}

describe('engineUserCashCreditor', () => {
  it('envia o valor pra rota de crédito do usuário e devolve o que foi creditado', async () => {
    respond(200, { user_id: 'u1', credited: 2500.5 })

    const result = await engine().credit('u1', 2500.504)

    expect(result).toEqual({ credited: 2500.5 })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://engine:8080/admin/accounts/u1/credit')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ amount: 2500.504 })
  })

  it.each([
    [400, CashCreditRejectedError],
    [404, AdminUserNotFoundError],
    [422, CashCreditOverflowError],
  ])('traduz o status %i do motor pro erro de domínio', async (status, errorClass) => {
    respond(status, { error: 'mensagem do motor' })

    const attempt = engine().credit('u1', 10)

    await expect(attempt).rejects.toBeInstanceOf(errorClass)
    await expect(attempt).rejects.toThrow('mensagem do motor')
  })

  it('falha genérica do motor vira erro comum (500 no router)', async () => {
    respond(500, {})

    await expect(engine().credit('u1', 10)).rejects.toThrow('status 500')
  })
})
