import type { EffectApplier } from '../../application/assemblyKinds'
import { engineJson } from './engineClient'

const METRICS = ['base_growth_pct', 'quality_multiplier'] as const
type Metric = (typeof METRICS)[number]

interface EngineEffect {
  metric: Metric
  direction: 1 | -1
  intensity: number
}

// O efeito vem do catálogo de pautas e nunca carrega valor absoluto: só métrica, sentido e que
// fração da faixa do motor usar. Valida aqui para um catálogo malformado falhar com mensagem clara
// (o motor valida de novo, e é ele quem decide o tamanho da mudança).
export function parseEngineEffect(raw: Record<string, unknown>): EngineEffect {
  const { metric, direction, intensity } = raw
  if (!METRICS.includes(metric as Metric))
    throw new Error(`métrica de efeito inválida: ${String(metric)}`)
  if (direction !== 1 && direction !== -1) throw new Error('direção do efeito precisa ser 1 ou -1')
  if (typeof intensity !== 'number' || !(intensity > 0 && intensity <= 1)) {
    throw new Error('intensidade do efeito precisa estar em (0, 1]')
  }
  return { metric: metric as Metric, direction, intensity }
}

// Entrega ao motor a decisão JÁ aprovada (`POST /governance/decisions`, idempotente pelo id da
// assembleia). Pauta que não passou (`winningOption` nulo) nunca chega ao motor.
export function createEngineShareholderEffect(engineUrl: string): EffectApplier {
  return {
    async apply(assembly, winningOption) {
      if (!winningOption) return
      await engineJson(`${engineUrl}/governance/decisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assembly_id: assembly.id,
          company_id: assembly.subjectRef,
          option_key: winningOption.key,
          effect: parseEngineEffect(winningOption.effect),
        }),
      })
    },
  }
}
