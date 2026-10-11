import { describe, expect, it } from 'vitest'
import { loadAssemblyConfig } from './assemblyConfig'

describe('loadAssemblyConfig', () => {
  it('vem desligado e com os prazos decididos pelo autor', () => {
    expect(loadAssemblyConfig({})).toEqual({
      enabled: false,
      lifecycle: { openDelayDays: 2, catchUpDays: 7, durationDays: 7, effectDelayDays: 1 },
      params: { minVoters: 3, monthlyFreeCredits: 1, freeCreditMinLevel: 3 },
    })
  })

  it('só liga com ASSEMBLIES_ENABLED=on', () => {
    expect(loadAssemblyConfig({ ASSEMBLIES_ENABLED: 'on' }).enabled).toBe(true)
    expect(loadAssemblyConfig({ ASSEMBLIES_ENABLED: 'true' }).enabled).toBe(false)
  })

  it('aceita override e cai no padrão com valor inválido', () => {
    const cfg = loadAssemblyConfig({
      ASSEMBLY_DURATION_DAYS: '5',
      ASSEMBLY_MIN_VOTERS: '10',
      ASSEMBLY_OPEN_DELAY_DAYS: 'abc',
      ASSEMBLY_EFFECT_DELAY_DAYS: '-1',
    })
    expect(cfg.lifecycle).toMatchObject({ durationDays: 5, openDelayDays: 2, effectDelayDays: 1 })
    expect(cfg.params.minVoters).toBe(10)
  })

  it('crédito mensal e nível mínimo são parâmetros', () => {
    const cfg = loadAssemblyConfig({
      ASSEMBLY_MONTHLY_FREE_CREDITS: '2',
      ASSEMBLY_FREE_CREDIT_MIN_LEVEL: '5',
    })
    expect(cfg.params).toMatchObject({ monthlyFreeCredits: 2, freeCreditMinLevel: 5 })
  })
})
