import { describe, expect, it, vi } from 'vitest'
import { createInProcessFriendProfileReader } from './inProcessFriendProfileReader'

describe('createInProcessFriendProfileReader', () => {
  it('devolve só nível e rentabilidade da semana, nada mais do perfil', async () => {
    const execute = vi.fn().mockResolvedValue({
      username: 'bia',
      level: 7,
      xp: 900,
      profitabilityPct: 2.5,
      window: 'week',
    })

    const result = await createInProcessFriendProfileReader({ execute }).read('u1')

    expect(execute).toHaveBeenCalledWith({ userId: 'u1', window: 'week' })
    expect(result).toEqual({ level: 7, profitabilityPct: 2.5 })
  })

  it('erro de leitura vira null em vez de derrubar o aviso', async () => {
    const reader = createInProcessFriendProfileReader({
      execute: vi.fn().mockRejectedValue(new Error('motor fora')),
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(await reader.read('u1')).toBeNull()
  })
})
