// Placar público de uma assembleia (MO.6.6): quantas pessoas votaram em cada opção e que fatia das
// ações (entre quem votou) ela reúne. Só percentual e contagem: nunca ações absolutas, valor em
// reais nem quem votou em quê (RNF09).
import type { Tally } from './assembly'
import { readOptionEffects, type DividendPolicy, type StepMetric } from './effects'

export interface OptionScore {
  optionId: string
  voters: number
  // 0 a 100, uma casa decimal, sobre o peso total de quem votou.
  weightPercent: number
}

export interface Scoreboard {
  voters: number
  options: OptionScore[]
}

export function buildScoreboard(tally: Tally): Scoreboard {
  const totalWeight = tally.totals.reduce((sum, t) => sum + t.weight, 0)
  return {
    voters: tally.voters,
    options: tally.totals.map((t) => ({
      optionId: t.optionId,
      voters: t.voters,
      weightPercent: totalWeight > 0 ? Math.round((t.weight / totalWeight) * 1000) / 10 : 0,
    })),
  }
}

export type EffectMetricLabel = 'growth' | 'quality' | 'payout' | 'pn_premium' | 'dividend_policy'

// Efeito da opção para a ficha da pauta: só a alavanca, o sentido e a intensidade (fração da faixa
// que o motor permite). O catálogo nunca carrega valor absoluto, e o tamanho final é do motor. A
// política de dividendo é discreta e traz o valor-alvo no lugar de sentido e intensidade.
export type EffectPreview =
  | { metric: Exclude<EffectMetricLabel, 'dividend_policy'>; direction: 1 | -1; intensity: number }
  | { metric: 'dividend_policy'; value: DividendPolicy }

const LABELS: Record<StepMetric, Exclude<EffectMetricLabel, 'dividend_policy'>> = {
  base_growth_pct: 'growth',
  quality_multiplier: 'quality',
  payout_ratio_pct: 'payout',
  pn_dividend_premium_pct: 'pn_premium',
}

// Leitura tolerante do `effect` jsonb (formato novo ou antigo): formato desconhecido vira lista
// vazia (a ficha só omite a faixa). Mesma ordem em que a pauta foi escrita.
export function readEffectPreviews(raw: Record<string, unknown>): EffectPreview[] {
  const effects = readOptionEffects(raw)
  if (!effects) return []
  return effects.map((e): EffectPreview =>
    e.metric === 'dividend_policy'
      ? { metric: 'dividend_policy', value: e.value }
      : { metric: LABELS[e.metric], direction: e.direction, intensity: e.intensity },
  )
}

// Primeiro efeito, para quem ainda lê um só (campo `effect` das respostas, anterior à Fase F2).
export function readEffectPreview(raw: Record<string, unknown>): EffectPreview | null {
  return readEffectPreviews(raw)[0] ?? null
}
