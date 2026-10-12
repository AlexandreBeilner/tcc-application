import { Router } from 'express'
import { evaluateReadiness, type ReadinessResult } from '../health/readiness'
import { getJobsHealth } from '../infra/jobHealth'
import type { GetSystemHealthUseCase } from '../modules/admin/application/useCases/getSystemHealth'
import type { GetSchedulerStatusUseCase } from '../modules/admin/application/useCases/getSchedulerStatus'
import { createRateLimiter } from '../shared/http/rateLimit'

export interface ReadinessDeps {
  getSystemHealth: GetSystemHealthUseCase
  getSchedulerStatus: GetSchedulerStatusUseCase
  now?: () => Date
}

// Resultado guardado por 10 s: o monitor externo consulta de tempos em tempos, e várias consultas
// seguidas (ou abuso) não viram uma rajada de sondas no banco, no Redis e no motor.
const CACHE_MS = 10_000

// GET /health/ready (LW.3.5): para o monitor externo (UptimeRobot, healthchecks.io etc.). Público de
// propósito e sem detalhes: só diz quais verificações passam ou falham (nomes de componentes e de jobs),
// nunca mensagem de erro, endereço interno ou dado de usuário. O detalhe vai para o log.
// `/health` (leve) continua sendo o healthcheck do Docker; este NÃO pode ser, ou um job atrasado
// reiniciaria o contêiner em laço.
export function createReadinessRouter(deps: ReadinessDeps): Router {
  const router = Router()
  const now = deps.now ?? (() => new Date())
  let cached: { at: number; result: ReadinessResult } | undefined

  // Detalhe das sondas que falharam, só para o log interno (a resposta pública nunca o inclui).
  let lastDetails: string[] = []

  async function compute(): Promise<ReadinessResult> {
    const [health, scheduler] = await Promise.all([
      deps.getSystemHealth.execute(),
      deps.getSchedulerStatus.execute().catch(() => null),
    ])
    lastDetails = health.components
      .filter((c) => c.status === 'fora' || (c.key === 'email_outbox' && c.status === 'degradado'))
      .map((c) => `${c.key}: ${c.detail ?? c.status}`)
    return evaluateReadiness({
      components: health.components,
      jobs: getJobsHealth(),
      scheduler,
      now: now(),
    })
  }

  router.get(
    '/health/ready',
    createRateLimiter({ windowMs: 60_000, max: 60 }),
    async (_req, res) => {
      const current = now().getTime()
      if (!cached || current - cached.at > CACHE_MS) {
        try {
          const result = await compute()
          cached = { at: current, result }
          if (!result.ok) {
            const failing = Object.entries(result.checks)
              .filter(([, v]) => v === 'fail')
              .map(([k]) => k)
            console.warn(`readiness: falhando (${failing.join(', ')})`, { details: lastDetails })
          }
        } catch (err) {
          console.error('readiness: erro ao avaliar', err)
          res.status(503).json({ status: 'falhou' })
          return
        }
      }
      res.status(cached.result.ok ? 200 : 503).json({
        status: cached.result.ok ? 'ok' : 'falhou',
        checks: cached.result.checks,
      })
    },
  )

  return router
}
