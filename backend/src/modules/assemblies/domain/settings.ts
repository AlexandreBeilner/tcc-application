// Parâmetros das assembleias editáveis no painel (MO.6.8). Regras puras: a faixa permitida de cada
// um e como os valores gravados se sobrepõem ao valor inicial (variável de ambiente ou padrão do
// código). A edição vale para as próximas assembleias; o quórum de uma já aberta fica congelado nela.
import type { AssemblyParams } from './assembly'
import { InvalidAssemblySettingError } from './errors'
import type { LifecycleParams } from './lifecycle'
import type { ProposalParams } from './proposals'

// O conjunto de parâmetros que o painel enxerga (a configuração completa tem ainda o liga/desliga).
export interface AssemblyTunables {
  lifecycle: LifecycleParams
  params: AssemblyParams
  proposals: ProposalParams
  participationXp: number
}

export const ASSEMBLY_SETTING_KEYS = [
  'min_voters',
  'duration_days',
  'open_delay_days',
  'catch_up_days',
  'effect_delay_days',
  'participation_xp',
  'proposal_monthly_cap',
  'proposal_min_support',
  'proposal_ttl_days',
] as const

export type AssemblySettingKey = (typeof ASSEMBLY_SETTING_KEYS)[number]

export interface AssemblySettingRange {
  key: AssemblySettingKey
  min: number
  max: number
}

// Faixas do painel: largas o bastante para calibrar (MO.6.9) e estreitas o bastante para um erro de
// digitação não fechar o recurso (ex.: duração zero ou mil votantes de quórum).
export const ASSEMBLY_SETTING_RANGES: readonly AssemblySettingRange[] = [
  { key: 'min_voters', min: 1, max: 1000 },
  { key: 'duration_days', min: 1, max: 60 },
  { key: 'open_delay_days', min: 1, max: 30 },
  { key: 'catch_up_days', min: 1, max: 30 },
  { key: 'effect_delay_days', min: 1, max: 30 },
  { key: 'participation_xp', min: 1, max: 500 },
  { key: 'proposal_monthly_cap', min: 1, max: 20 },
  { key: 'proposal_min_support', min: 1, max: 50 },
  { key: 'proposal_ttl_days', min: 1, max: 180 },
]

export type AssemblySettingValues = Record<AssemblySettingKey, number>
export type AssemblySettingOverrides = Partial<AssemblySettingValues>

export function isAssemblySettingKey(key: string): key is AssemblySettingKey {
  return (ASSEMBLY_SETTING_KEYS as readonly string[]).includes(key)
}

export function rangeOf(key: AssemblySettingKey): AssemblySettingRange {
  return ASSEMBLY_SETTING_RANGES.find((r) => r.key === key) as AssemblySettingRange
}

export function valuesOf(t: AssemblyTunables): AssemblySettingValues {
  return {
    min_voters: t.params.minVoters,
    duration_days: t.lifecycle.durationDays,
    open_delay_days: t.lifecycle.openDelayDays,
    catch_up_days: t.lifecycle.catchUpDays,
    effect_delay_days: t.lifecycle.effectDelayDays,
    participation_xp: t.participationXp,
    proposal_monthly_cap: t.proposals.monthlyCap,
    proposal_min_support: t.proposals.minSupport,
    proposal_ttl_days: t.proposals.ttlDays,
  }
}

// Valor inteiro dentro da faixa; senão `InvalidAssemblySettingError` (o painel mostra a faixa).
export function validateSettingValue(key: AssemblySettingKey, value: number): void {
  const { min, max } = rangeOf(key)
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new InvalidAssemblySettingError(`valor deve ser um inteiro de ${min} a ${max}`)
  }
}

// Sobrepõe os valores gravados ao valor inicial. Linha gravada fora da faixa (editada à mão no
// banco) é ignorada: nunca derruba o ciclo, vale o valor inicial.
export function applyOverrides<T extends AssemblyTunables>(
  base: T,
  overrides: AssemblySettingOverrides,
): AssemblyTunables {
  const values = valuesOf(base)
  for (const { key, min, max } of ASSEMBLY_SETTING_RANGES) {
    const value = overrides[key]
    if (value !== undefined && Number.isInteger(value) && value >= min && value <= max) {
      values[key] = value
    }
  }
  return {
    lifecycle: {
      openDelayDays: values.open_delay_days,
      catchUpDays: values.catch_up_days,
      durationDays: values.duration_days,
      effectDelayDays: values.effect_delay_days,
    },
    params: {
      minVoters: values.min_voters,
    },
    proposals: {
      monthlyCap: values.proposal_monthly_cap,
      minSupport: values.proposal_min_support,
      ttlDays: values.proposal_ttl_days,
    },
    participationXp: values.participation_xp,
  }
}
