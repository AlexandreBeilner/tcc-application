import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEngineAccountProvisioner } from './engineAccountProvisioner'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

describe('engineAccountProvisioner', () => {
  it('chama POST /accounts no motor com o user_id', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 201 })
    const provisioner = createEngineAccountProvisioner('http://engine:8080')

    await provisioner.provision('user-1')

    expect(fetchMock).toHaveBeenCalledWith('http://engine:8080/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: 'user-1' }),
    })
  })

  it('trata 409 (conta já existe) como sucesso', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 409 })
    const provisioner = createEngineAccountProvisioner('http://engine:8080')

    await expect(provisioner.provision('user-1')).resolves.toBeUndefined()
  })

  it('lança erro em qualquer outra falha do motor', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 })
    const provisioner = createEngineAccountProvisioner('http://engine:8080')

    await expect(provisioner.provision('user-1')).rejects.toThrow(/falha ao abrir conta/)
  })
})
