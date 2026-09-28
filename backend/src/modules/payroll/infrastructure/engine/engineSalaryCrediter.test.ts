import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEngineSalaryCrediter } from './engineSalaryCrediter'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

describe('engineSalaryCrediter', () => {
  it('chama POST /accounts/{user_id}/salary no motor com o amount e o reference_month', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204 })
    const crediter = createEngineSalaryCrediter('http://engine:8080')

    await crediter.credit('user-1', 1000, '2026-09')

    expect(fetchMock).toHaveBeenCalledWith('http://engine:8080/accounts/user-1/salary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 1000, reference_month: '2026-09' }),
    })
  })

  it('lança erro em qualquer falha do motor', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 })
    const crediter = createEngineSalaryCrediter('http://engine:8080')

    await expect(crediter.credit('user-1', 1000, '2026-09')).rejects.toThrow(/falha ao creditar salário/)
  })
})
