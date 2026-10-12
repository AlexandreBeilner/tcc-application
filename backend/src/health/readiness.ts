import type { ComponentHealth } from '../modules/admin/domain/systemHealth'
import type { SchedulerStatus } from '../modules/admin/application/ports/schedulerAdmin'
import type { JobHealth } from '../infra/jobHealth'

// Decide se o sistema está "pronto" para o monitor externo (LW.3.5): componentes de pé, agendadores do
// backend em dia e Temporizador do motor tickando. Função pura: quem junta os dados é a rota.
const TICK_TOLERANCE_MS = 30 * 60_000

export interface ReadinessInput {
  components: ComponentHealth[]
  jobs: JobHealth[]
  scheduler: SchedulerStatus | null
  now: Date
}

export interface ReadinessResult {
  ok: boolean
  checks: Record<string, 'ok' | 'fail'>
}

export function evaluateReadiness(input: ReadinessInput): ReadinessResult {
  const checks: Record<string, 'ok' | 'fail'> = {}

  for (const component of input.components) {
    // Latência alta ('degradado') não derruba; o outbox de e-mail em 'degradado' significa fila parada
    // ou muitas falhas, e esse é o alerta de worker de e-mail pedido na LW.3.5.
    const failed =
      component.status === 'fora' ||
      (component.key === 'email_outbox' && component.status === 'degradado')
    checks[component.key] = failed ? 'fail' : 'ok'
  }

  for (const job of input.jobs) {
    checks[`job:${job.name}`] = job.status === 'ok' ? 'ok' : 'fail'
  }

  // Temporizador do mercado: com a agenda ligada e sem pausa, o último tick não pode ter mais de dois
  // intervalos. Pausa e agenda desligada são decisões deliberadas, não falha. Servidor novo (sem tick) tem
  // tolerância: o primeiro tick roda na subida do motor.
  if (
    input.scheduler &&
    input.scheduler.enabled &&
    !input.scheduler.paused &&
    input.scheduler.last_tick_at
  ) {
    const intervalMs = (24 * 3_600_000) / Math.max(1, input.scheduler.ticks_per_day)
    const age = input.now.getTime() - new Date(input.scheduler.last_tick_at).getTime()
    checks.market_tick = age > 2 * intervalMs + TICK_TOLERANCE_MS ? 'fail' : 'ok'
  }

  return { ok: Object.values(checks).every((value) => value === 'ok'), checks }
}
