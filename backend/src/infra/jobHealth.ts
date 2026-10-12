// Saúde dos agendadores do backend (LW.3.5): cada job registra quando rodou com sucesso e quando falhou.
// Um job que não tem sucesso há mais de 3 intervalos (ou falhou 3 vezes seguidas) é reportado como
// problema em `/health/ready`, que o monitor externo consulta. É estado em memória do processo (o backend é
// singleton); depois de um reinício, o job ganha 3 intervalos de tolerância contados da subida.
const MISSED_INTERVALS = 3
const FAILURES_TO_ALERT = 3

interface JobState {
  intervalMs: number
  registeredAt: number
  lastSuccessAt?: number
  lastFailureAt?: number
  consecutiveFailures: number
}

export interface JobHealth {
  name: string
  status: 'ok' | 'atrasado' | 'falhando'
  lastSuccessAt: string | null
  lastFailureAt: string | null
  consecutiveFailures: number
}

const jobs = new Map<string, JobState>()
let clock: () => number = Date.now

export function registerJob(name: string, intervalMs: number): void {
  jobs.set(name, { intervalMs, registeredAt: clock(), consecutiveFailures: 0 })
}

export function recordJobSuccess(name: string): void {
  const job = jobs.get(name)
  if (!job) return
  job.lastSuccessAt = clock()
  job.consecutiveFailures = 0
}

export function recordJobFailure(name: string): void {
  const job = jobs.get(name)
  if (!job) return
  job.lastFailureAt = clock()
  job.consecutiveFailures += 1
}

export function getJobsHealth(now: number = clock()): JobHealth[] {
  return [...jobs.entries()].map(([name, job]) => {
    const reference = job.lastSuccessAt ?? job.registeredAt
    const overdue = now - reference > job.intervalMs * MISSED_INTERVALS
    const failing = job.consecutiveFailures >= FAILURES_TO_ALERT
    return {
      name,
      status: failing ? 'falhando' : overdue ? 'atrasado' : 'ok',
      lastSuccessAt: job.lastSuccessAt ? new Date(job.lastSuccessAt).toISOString() : null,
      lastFailureAt: job.lastFailureAt ? new Date(job.lastFailureAt).toISOString() : null,
      consecutiveFailures: job.consecutiveFailures,
    }
  })
}

// Só para testes.
export function resetJobHealthForTests(now?: () => number): void {
  jobs.clear()
  clock = now ?? Date.now
}
