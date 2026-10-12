import { describe, expect, it, vi } from 'vitest'
import { createEngineCompanyCooldownReader } from './engineCompanyCooldownReader'

describe('engineCompanyCooldownReader', () => {
  it('devolve os dias de espera da empresa consultando o standing com o UUID nulo', async () => {
    const get = vi.fn(async () => ({
      companyId: 'c1',
      name: 'Alfa',
      sector: 'Varejo',
      holdsShares: false,
      cooldownDaysLeft: 12,
    }))
    const reader = createEngineCompanyCooldownReader({ get })

    expect(await reader.daysLeft('c1')).toBe(12)
    expect(get).toHaveBeenCalledWith('c1', '00000000-0000-0000-0000-000000000000')
  })

  it('empresa que o motor não conhece vira erro (a abertura conta a falha)', async () => {
    const reader = createEngineCompanyCooldownReader({ get: vi.fn(async () => null) })
    await expect(reader.daysLeft('c1')).rejects.toThrow('desconhecida')
  })
})
