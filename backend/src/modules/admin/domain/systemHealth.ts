// Saúde de um componente na visão geral do painel (N.5): "ok", "degradado" (respondeu,
// mas devagar) ou "fora" (falhou ou estourou o prazo).
export type HealthStatus = 'ok' | 'degradado' | 'fora'

export type HealthComponentKey = 'backend' | 'engine' | 'gamification_db' | 'market_db' | 'redis'

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
