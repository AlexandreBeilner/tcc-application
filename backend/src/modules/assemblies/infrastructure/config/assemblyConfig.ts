import { DEFAULT_ASSEMBLY_PARAMS, type AssemblyParams } from '../../domain/assembly'
import { DEFAULT_LIFECYCLE_PARAMS, type LifecycleParams } from '../../domain/lifecycle'
import { DEFAULT_PROPOSAL_PARAMS, type ProposalParams } from '../../domain/proposals'

export interface AssemblyConfig {
  // Desligado por padrão: ligar só depois da calibração (MO.6.9).
  enabled: boolean
  lifecycle: LifecycleParams
  params: AssemblyParams
  proposals: ProposalParams
}

function positiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw || Number.NaN)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

// Parâmetros por variável de ambiente até a tabela editável do painel (MO.6.8). Valor inválido
// cai no padrão, nunca derruba a subida.
export function loadAssemblyConfig(env: NodeJS.ProcessEnv): AssemblyConfig {
  return {
    enabled: env.ASSEMBLIES_ENABLED === 'on',
    lifecycle: {
      openDelayDays: positiveInt(
        env.ASSEMBLY_OPEN_DELAY_DAYS,
        DEFAULT_LIFECYCLE_PARAMS.openDelayDays,
      ),
      catchUpDays: positiveInt(env.ASSEMBLY_CATCH_UP_DAYS, DEFAULT_LIFECYCLE_PARAMS.catchUpDays),
      durationDays: positiveInt(env.ASSEMBLY_DURATION_DAYS, DEFAULT_LIFECYCLE_PARAMS.durationDays),
      effectDelayDays: positiveInt(
        env.ASSEMBLY_EFFECT_DELAY_DAYS,
        DEFAULT_LIFECYCLE_PARAMS.effectDelayDays,
      ),
    },
    params: {
      minVoters: positiveInt(env.ASSEMBLY_MIN_VOTERS, DEFAULT_ASSEMBLY_PARAMS.minVoters),
      monthlyFreeCredits: positiveInt(
        env.ASSEMBLY_MONTHLY_FREE_CREDITS,
        DEFAULT_ASSEMBLY_PARAMS.monthlyFreeCredits,
      ),
      freeCreditMinLevel: positiveInt(
        env.ASSEMBLY_FREE_CREDIT_MIN_LEVEL,
        DEFAULT_ASSEMBLY_PARAMS.freeCreditMinLevel,
      ),
    },
    proposals: {
      monthlyCap: positiveInt(
        env.ASSEMBLY_PROPOSAL_MONTHLY_CAP,
        DEFAULT_PROPOSAL_PARAMS.monthlyCap,
      ),
      minSupport: positiveInt(
        env.ASSEMBLY_PROPOSAL_MIN_SUPPORT,
        DEFAULT_PROPOSAL_PARAMS.minSupport,
      ),
      ttlDays: positiveInt(env.ASSEMBLY_PROPOSAL_TTL_DAYS, DEFAULT_PROPOSAL_PARAMS.ttlDays),
    },
  }
}
