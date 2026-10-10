// Saúde de um componente na visão geral do painel (N.5): "ok", "degradado" (respondeu,
// mas devagar) ou "fora" (falhou ou estourou o prazo).
export type HealthStatus = 'ok' | 'degradado' | 'fora'

export type HealthComponentKey =
  'backend' | 'engine' | 'gamification_db' | 'market_db' | 'redis' | 'email_outbox'

export interface ComponentHealth {
  key: HealthComponentKey
  status: HealthStatus
  latency_ms: number | null
  detail: string | null
}

// Acima disso o componente respondeu, mas a tela deve avisar que está lento.
export const DEGRADED_LATENCY_MS = 1000

// Prazo máximo de uma sonda: passou disso, o componente conta como fora.
export const PROBE_TIMEOUT_MS = 3000

export function classifyLatency(latencyMs: number): HealthStatus {
  return latencyMs > DEGRADED_LATENCY_MS ? 'degradado' : 'ok'
}

// Fila de e-mail (EM.8.1). Pendente que já devia ter saído há mais que isso é fila parada
// (worker fora ou provedor recusando): recuperação de senha não pode esperar tanto.
export const OUTBOX_STALE_PENDING_MS = 10 * 60_000

// Falhas definitivas nas últimas 24 h a partir das quais o painel avisa que estão acumulando.
export const OUTBOX_FAILED_ALERT_COUNT = 5

export interface OutboxStats {
  // Linhas `pending` já vencidas (um reenvio agendado pra daqui a horas não conta).
  pending: number
  failedLast24h: number
  // Há quanto tempo a pendente vencida mais antiga devia ter saído; `null` sem pendentes.
  oldestPendingAgeMs: number | null
}

function describeAge(ms: number): string {
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return 'menos de 1 min'
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}

// Alerta, não queda: fila parada ou falhas acumulando viram "degradado" (o backend segue de
// pé), com o motivo escrito. O resumo dos contadores aparece também quando está tudo certo.
export function classifyOutbox(stats: OutboxStats): { status: HealthStatus; detail: string } {
  const summary = `${stats.pending} pendente(s), ${stats.failedLast24h} falha(s) em 24 h`
  const alerts: string[] = []
  if (stats.oldestPendingAgeMs !== null && stats.oldestPendingAgeMs > OUTBOX_STALE_PENDING_MS) {
    alerts.push(`pendente mais antigo espera há ${describeAge(stats.oldestPendingAgeMs)}`)
  }
  if (stats.failedLast24h >= OUTBOX_FAILED_ALERT_COUNT) {
    alerts.push('falhas acumulando')
  }
  if (alerts.length === 0) return { status: 'ok', detail: summary }
  return { status: 'degradado', detail: `${alerts.join('; ')} (${summary})` }
}
