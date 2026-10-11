// Placar público de uma assembleia (MO.6.6): quantas pessoas votaram em cada opção e que fatia das
// ações (entre quem votou) ela reúne. Só percentual e contagem: nunca ações absolutas, valor em
// reais nem quem votou em quê (RNF09).
import type { Tally } from './assembly'

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

export type EffectMetricLabel = 'growth' | 'quality'

// Efeito da opção para a ficha da pauta: só a métrica, o sentido e a intensidade (fração da faixa
// que o motor permite). O catálogo nunca carrega valor absoluto, e o tamanho final é do motor.
export interface EffectPreview {
  metric: EffectMetricLabel
  direction: 1 | -1
  intensity: number
}

// Leitura tolerante do `effect` jsonb: formato desconhecido vira `null` (a ficha só omite a faixa).
export function readEffectPreview(raw: Record<string, unknown>): EffectPreview | null {
  const { metric, direction, intensity } = raw
  const label =
    metric === 'base_growth_pct' ? 'growth' : metric === 'quality_multiplier' ? 'quality' : null
  if (!label || (direction !== 1 && direction !== -1)) return null
  if (typeof intensity !== 'number' || !(intensity > 0 && intensity <= 1)) return null
  return { metric: label, direction, intensity }
}
