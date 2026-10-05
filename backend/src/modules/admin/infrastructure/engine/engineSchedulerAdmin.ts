import {
  SchedulerDisabledError,
  TickAdvanceFailedError,
  TickInProgressError,
} from '../../domain/errors'
import type {
  AdvanceTicksResult,
  ListTicksQuery,
  ListTicksResult,
  SchedulerAdmin,
  SchedulerStatus,
} from '../../application/ports/schedulerAdmin'
import type { TickResult } from '../../application/ports/tickTrigger'

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  return body.error ?? fallback
}

export function createEngineSchedulerAdmin(engineUrl: string): SchedulerAdmin {
  async function readStatus(
    path: string,
    init: RequestInit,
    failure: string,
  ): Promise<SchedulerStatus> {
    const res = await fetch(`${engineUrl}${path}`, init)
    // 409 em pause/resume = agenda desligada no ambiente (não há o que pausar).
    if (res.status === 409) {
      throw new SchedulerDisabledError(
        await errorMessage(res, 'a agenda automática está desligada'),
      )
    }
    if (!res.ok) {
      throw new Error(`${failure} (status ${res.status})`)
    }
    return (await res.json()) as SchedulerStatus
  }

  return {
    async getStatus() {
      return readStatus(
        '/admin/scheduler',
        {},
        'falha ao ler o estado do temporizador no motor de simulação',
      )
    },

    async pause() {
      return readStatus(
        '/admin/scheduler/pause',
        { method: 'POST' },
        'falha ao pausar o temporizador no motor de simulação',
      )
    },

    async resume() {
      return readStatus(
        '/admin/scheduler/resume',
        { method: 'POST' },
        'falha ao retomar o temporizador no motor de simulação',
      )
    },

    async listTicks(query: ListTicksQuery): Promise<ListTicksResult> {
      const params = new URLSearchParams()
      if (query.limit !== undefined) params.set('limit', String(query.limit))
      if (query.offset !== undefined) params.set('offset', String(query.offset))
      const qs = params.toString()
      const res = await fetch(`${engineUrl}/admin/ticks${qs ? `?${qs}` : ''}`)
      if (!res.ok) {
        throw new Error(
          `falha ao listar o histórico de ticks no motor de simulação (status ${res.status})`,
        )
      }
      return (await res.json()) as ListTicksResult
    },

    async advance(days: number): Promise<AdvanceTicksResult> {
      const res = await fetch(`${engineUrl}/admin/tick/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days }),
      })
      if (res.status === 409) {
        throw new TickInProgressError(await errorMessage(res, 'já existe um tick em andamento'))
      }
      // 500 com `ticks`: o motor rodou parte dos dias antes de falhar.
      if (res.status === 500) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string
          ticks?: TickResult[]
        }
        throw new TickAdvanceFailedError(
          `falha ao avançar ${days} dia(s) no motor de simulação: ${body.error ?? 'erro desconhecido'}`,
          body.ticks ?? [],
        )
      }
      if (!res.ok) {
        throw new Error(`falha ao avançar o tempo no motor de simulação (status ${res.status})`)
      }
      return (await res.json()) as AdvanceTicksResult
    },
  }
}
