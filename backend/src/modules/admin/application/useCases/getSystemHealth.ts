import {
  classifyLatency,
  classifyOutbox,
  PROBE_TIMEOUT_MS,
  type ComponentHealth,
  type HealthComponentKey,
} from '../../domain/systemHealth'
import type { EmailOutboxHealthReader } from '../ports/emailOutboxHealthReader'
import type { HealthProbe } from '../ports/healthProbe'

type ProbedKey = Exclude<HealthComponentKey, 'backend' | 'email_outbox'>

export type SystemProbes = Record<ProbedKey, HealthProbe>

export interface SystemHealth {
  checked_at: string
  components: ComponentHealth[]
}

const ORDER: ProbedKey[] = ['engine', 'gamification_db', 'market_db', 'redis']

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
    private readonly emailOutbox: EmailOutboxHealthReader,
    private readonly timeoutMs: number = PROBE_TIMEOUT_MS,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(): Promise<SystemHealth> {
    const [probed, outbox] = await Promise.all([
      Promise.all(ORDER.map((key) => this.probe(key))),
      this.probeOutbox(),
    ])
    return {
      checked_at: this.now().toISOString(),
      components: [
        { key: 'backend', status: 'ok', latency_ms: 0, detail: null },
        ...probed,
        outbox,
      ],
    }
  }

  private async probe(key: ProbedKey): Promise<ComponentHealth> {
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

  // A fila de e-mail não é sondada por resposta, é lida por contadores (EM.8.1); se a leitura
  // falha, o componente vira "fora" como qualquer sonda.
  private async probeOutbox(): Promise<ComponentHealth> {
    const startedAt = performance.now()
    try {
      const stats = await withTimeout(this.emailOutbox.read(this.now()), this.timeoutMs)
      const latency = Math.round(performance.now() - startedAt)
      return { key: 'email_outbox', latency_ms: latency, ...classifyOutbox(stats) }
    } catch (err) {
      return {
        key: 'email_outbox',
        status: 'fora',
        latency_ms: null,
        detail: err instanceof Error ? err.message : String(err),
      }
    }
  }
}
