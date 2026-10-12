import { describe, expect, it } from 'vitest'
import { DEFAULT_ASSEMBLY_PARAMS } from './assembly'
import { InvalidAssemblySettingError } from './errors'
import { DEFAULT_LIFECYCLE_PARAMS } from './lifecycle'
import { DEFAULT_PROPOSAL_PARAMS } from './proposals'
import {
  applyOverrides,
  ASSEMBLY_SETTING_KEYS,
  ASSEMBLY_SETTING_RANGES,
  isAssemblySettingKey,
  validateSettingValue,
  valuesOf,
  type AssemblyTunables,
} from './settings'

const base: AssemblyTunables = {
  lifecycle: DEFAULT_LIFECYCLE_PARAMS,
  params: DEFAULT_ASSEMBLY_PARAMS,
  proposals: DEFAULT_PROPOSAL_PARAMS,
  participationXp: 10,
}

describe('parâmetros editáveis das assembleias', () => {
  it('toda chave tem uma faixa e um valor inicial dentro dela', () => {
    expect(ASSEMBLY_SETTING_RANGES.map((r) => r.key).sort()).toEqual(
      [...ASSEMBLY_SETTING_KEYS].sort(),
    )
    const values = valuesOf(base)
    for (const { key, min, max } of ASSEMBLY_SETTING_RANGES) {
      expect(values[key], key).toBeGreaterThanOrEqual(min)
      expect(values[key], key).toBeLessThanOrEqual(max)
    }
  })

  it('valuesOf lê cada parâmetro do lugar certo', () => {
    expect(valuesOf(base)).toEqual({
      min_voters: 3,
      duration_days: 7,
      open_delay_days: 2,
      catch_up_days: 7,
      effect_delay_days: 1,
      monthly_free_credits: 1,
      free_credit_min_level: 3,
      participation_xp: 10,
      proposal_monthly_cap: 3,
      proposal_min_support: 2,
      proposal_ttl_days: 30,
    })
  })

  it('sobrepõe só o que foi gravado e devolve o resto como estava', () => {
    const result = applyOverrides(base, { min_voters: 5, duration_days: 3, participation_xp: 25 })
    expect(result.params).toEqual({ minVoters: 5, monthlyFreeCredits: 1, freeCreditMinLevel: 3 })
    expect(result.lifecycle).toEqual({ ...DEFAULT_LIFECYCLE_PARAMS, durationDays: 3 })
    expect(result.proposals).toEqual(DEFAULT_PROPOSAL_PARAMS)
    expect(result.participationXp).toBe(25)
    // A base nunca é alterada: restaurar precisa devolver o valor inicial.
    expect(base.params.minVoters).toBe(3)
  })

  it.each([
    ['fora da faixa (alto)', 5000],
    ['fora da faixa (zero)', 0],
    ['fracionado', 2.5],
    ['não finito', Number.NaN],
  ])('ignora linha gravada %s (editada à mão no banco) e mantém o valor inicial', (_n, value) => {
    expect(applyOverrides(base, { min_voters: value }).params.minVoters).toBe(3)
  })

  it('validateSettingValue aceita os limites e recusa fora deles com a faixa na mensagem', () => {
    validateSettingValue('min_voters', 1)
    validateSettingValue('min_voters', 1000)
    expect(() => validateSettingValue('min_voters', 0)).toThrow(InvalidAssemblySettingError)
    expect(() => validateSettingValue('min_voters', 1001)).toThrow(/1 a 1000/)
    expect(() => validateSettingValue('duration_days', 1.5)).toThrow(InvalidAssemblySettingError)
  })

  it('reconhece só as chaves conhecidas', () => {
    expect(isAssemblySettingKey('min_voters')).toBe(true)
    expect(isAssemblySettingKey('governance_ramp_ticks')).toBe(false)
  })
})

// Quórum de lançamento aprovado pelo autor em 2026-10-11 (MO.6.9). Literal de propósito: mudar o
// padrão exige mudar este teste junto. Vem de um eleitorado simulado; revisar com base real.
describe('padrões de lançamento da Assembleia (MO.6.9)', () => {
  it('mantém o mínimo de 3 votantes aprovado', () => {
    expect(DEFAULT_ASSEMBLY_PARAMS.minVoters).toBe(3)
  })
})
