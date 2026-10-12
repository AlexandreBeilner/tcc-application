import { describe, expect, it } from 'vitest'
import { loadAssemblyConfig } from './assemblyConfig'

describe('loadAssemblyConfig', () => {
  it('vem ligado e com os prazos decididos pelo autor', () => {
    expect(loadAssemblyConfig({})).toEqual({
      enabled: true,
      lifecycle: { openDelayDays: 2, catchUpDays: 7, durationDays: 7, effectDelayDays: 1 },
      params: { minVoters: 3, monthlyFreeCredits: 1, freeCreditMinLevel: 3 },
      proposals: { monthlyCap: 3, minSupport: 2, ttlDays: 30 },
      participationXp: 10,
    })
  })

  it('nasce ligada: sem a variável, ou com qualquer valor que não seja off, fica ligada', () => {
    expect(loadAssemblyConfig({}).enabled).toBe(true)
    expect(loadAssemblyConfig({ ASSEMBLIES_ENABLED: '' }).enabled).toBe(true)
    expect(loadAssemblyConfig({ ASSEMBLIES_ENABLED: 'on' }).enabled).toBe(true)
  })

  it('só ASSEMBLIES_ENABLED=off desliga (desligamento de emergência)', () => {
    expect(loadAssemblyConfig({ ASSEMBLIES_ENABLED: 'off' }).enabled).toBe(false)
    expect(loadAssemblyConfig({ ASSEMBLIES_ENABLED: ' OFF ' }).enabled).toBe(false)
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

  it('XP de participação é parâmetro, com 10 de padrão', () => {
    expect(loadAssemblyConfig({ ASSEMBLY_PARTICIPATION_XP: '25' }).participationXp).toBe(25)
    expect(loadAssemblyConfig({ ASSEMBLY_PARTICIPATION_XP: '0' }).participationXp).toBe(10)
  })

  it('teto de propostas, apoios mínimos e prazo são parâmetros', () => {
    const cfg = loadAssemblyConfig({
      ASSEMBLY_PROPOSAL_MONTHLY_CAP: '5',
      ASSEMBLY_PROPOSAL_MIN_SUPPORT: '4',
      ASSEMBLY_PROPOSAL_TTL_DAYS: 'x',
    })
    expect(cfg.proposals).toEqual({ monthlyCap: 5, minSupport: 4, ttlDays: 30 })
  })
})
