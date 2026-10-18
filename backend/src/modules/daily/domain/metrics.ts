// Contadores do Diário (DI.7.1). Quatro contadores gravados (anônimo e origem) e dois lidos de
// `daily_results` (logado). Nenhum guarda identificador de pessoa.
export const METRIC_EVENTS = ['started', 'completed', 'signup', 'login'] as const
export type MetricEvent = (typeof METRIC_EVENTS)[number]

export const STORED_METRICS = [
  'anon_started',
  'anon_completed',
  'origin_signup',
  'origin_login',
] as const
export type StoredMetric = (typeof STORED_METRICS)[number]

// `started` e `completed` vêm da página pública da landing (quem joga sem conta); `signup` e
// `login` vêm do app, de quem chegou com `?origem=diario`.
const METRIC_BY_EVENT: Record<MetricEvent, StoredMetric> = {
  started: 'anon_started',
  completed: 'anon_completed',
  signup: 'origin_signup',
  login: 'origin_login',
}

export function metricForEvent(event: MetricEvent): StoredMetric {
  return METRIC_BY_EVENT[event]
}

export interface DailyMetricsDay {
  date: string
  anonStarted: number
  anonCompleted: number
  loggedStarted: number
  loggedCompleted: number
  signups: number
  logins: number
}

export const DEFAULT_METRICS_DAYS = 30
export const MAX_METRICS_DAYS = 90
