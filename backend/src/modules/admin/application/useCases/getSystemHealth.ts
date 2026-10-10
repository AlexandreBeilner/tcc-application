import {
  classifyLatency,
  PROBE_TIMEOUT_MS,
  type ComponentHealth,
  type HealthComponentKey,
} from '../../domain/systemHealth'
import type { HealthProbe } from '../ports/healthProbe'

export type SystemProbes = Record<Exclude<HealthComponentKey, 'backend'>, HealthProbe>

export interface SystemHealth {
  checked_at: string
  components: ComponentHealth[]
}

const ORDER: Array<Exclude<HealthComponentKey, 'backend'>> = [
  'engine',
  'gamification_db',
  'market_db',
  'redis',
]

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`sem resposta em ${ms} ms`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

// Saúde de cada componente da cadeia (N.5). O backend consulta os outros em
// paralelo; um que falha ou demora vira "fora" naquela linha, nunca derruba a
// resposta. O próprio backend está "ok" por definição (se respondeu, está de pé).
export class GetSystemHealthUseCase {
  constructor(
    private readonly probes: SystemProbes,
    private readonly timeoutMs: number = PROBE_TIMEOUT_MS,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(): Promise<SystemHealth> {
    const probed = await Promise.all(ORDER.map((key) => this.probe(key)))
    return {
      checked_at: this.now().toISOString(),
      components: [{ key: 'backend', status: 'ok', latency_ms: 0, detail: null }, ...probed],
    }
  }

  private async probe(key: Exclude<HealthComponentKey, 'backend'>): Promise<ComponentHealth> {
    const startedAt = performance.now()
    try {
      await withTimeout(this.probes[key].check(), this.timeoutMs)
      const latency = Math.round(performance.now() - startedAt)
      return { key, status: classifyLatency(latency), latency_ms: latency, detail: null }
    } catch (err) {
      return {
        key,
        status: 'fora',
        latency_ms: null,
        detail: err instanceof Error ? err.message : String(err),
      }
    }
  }
}
