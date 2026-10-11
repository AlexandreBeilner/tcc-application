import { describe, expect, it } from 'vitest'
import { DEFAULT_ASSEMBLY_PARAMS } from '../domain/assembly'
import { InvalidAssemblySettingError } from '../domain/errors'
import { DEFAULT_LIFECYCLE_PARAMS } from '../domain/lifecycle'
import { DEFAULT_PROPOSAL_PARAMS } from '../domain/proposals'
import type { AssemblyTunables } from '../domain/settings'
import { createFakeAssemblySettingsStore } from '../test/fakes/fakeAssemblySettingsStore'
import { AssemblySettingsService } from './assemblySettingsService'

const T = new Date('2026-10-11T12:00:00Z')

function setup() {
  const base: AssemblyTunables = {
    lifecycle: { ...DEFAULT_LIFECYCLE_PARAMS },
    params: { ...DEFAULT_ASSEMBLY_PARAMS },
    proposals: { ...DEFAULT_PROPOSAL_PARAMS },
    participationXp: 10,
  }
  // O objeto vivo é o que o resto do módulo lê; a base é a cópia de antes de qualquer edição.
  const live = structuredClone(base)
  const store = createFakeAssemblySettingsStore()
  return { live, store, service: new AssemblySettingsService(base, live, store, () => T) }
}

describe('AssemblySettingsService', () => {
  it('sem nada gravado, vale o valor inicial e nenhum parâmetro aparece como alterado', async () => {
    const { service, live } = setup()
    await service.refresh()
    expect(live.params.minVoters).toBe(3)
    const list = await service.list()
    expect(list).toHaveLength(11)
    expect(list.every((s) => !s.overridden && s.value === s.default)).toBe(true)
  })

  it('gravar muda o objeto vivo na hora, sem reiniciar, e registra quem e quando', async () => {
    const { service, live, store } = setup()
    const list = await service.set('min_voters', 7, 'admin-1')
    expect(live.params.minVoters).toBe(7)
    expect(store.rows.get('min_voters')).toMatchObject({
      value: 7,
      updatedBy: 'admin-1',
      updatedAt: T,
    })
    expect(list.find((s) => s.key === 'min_voters')).toMatchObject({
      value: 7,
      default: 3,
      overridden: true,
      updatedBy: 'admin-1',
      updatedAt: T,
    })
  })

  it('cada parâmetro chega ao grupo certo da configuração viva', async () => {
    const { service, live } = setup()
    await service.set('duration_days', 14, 'a')
    await service.set('proposal_monthly_cap', 5, 'a')
    await service.set('participation_xp', 30, 'a')
    await service.set('free_credit_min_level', 4, 'a')
    expect(live.lifecycle.durationDays).toBe(14)
    expect(live.proposals.monthlyCap).toBe(5)
    expect(live.participationXp).toBe(30)
    expect(live.params.freeCreditMinLevel).toBe(4)
  })

  it('restaurar volta ao valor inicial e apaga a linha', async () => {
    const { service, live, store } = setup()
    await service.set('min_voters', 7, 'admin-1')
    const list = await service.reset('min_voters')
    expect(live.params.minVoters).toBe(3)
    expect(store.rows.has('min_voters')).toBe(false)
    expect(list.find((s) => s.key === 'min_voters')?.overridden).toBe(false)
  })

  it('o refresh traz o que outro processo gravou', async () => {
    const { service, live, store } = setup()
    await store.upsert('min_voters', 9, 'admin-2', T)
    await service.refresh()
    expect(live.params.minVoters).toBe(9)
  })

  it('recusa valor fora da faixa e chave desconhecida, sem gravar nada', async () => {
    const { service, store, live } = setup()
    await expect(service.set('min_voters', 0, 'a')).rejects.toBeInstanceOf(
      InvalidAssemblySettingError,
    )
    await expect(service.set('min_voters', 1001, 'a')).rejects.toThrow(/1 a 1000/)
    await expect(service.set('inexistente', 3, 'a')).rejects.toThrow(/desconhecido/)
    await expect(service.reset('inexistente')).rejects.toBeInstanceOf(InvalidAssemblySettingError)
    expect(store.rows.size).toBe(0)
    expect(live.params.minVoters).toBe(3)
  })

  it('uma linha gravada fora da faixa não derruba nem muda nada', async () => {
    const { service, live, store } = setup()
    await store.upsert('min_voters', 99999, 'x', T)
    await service.refresh()
    expect(live.params.minVoters).toBe(3)
  })
})
