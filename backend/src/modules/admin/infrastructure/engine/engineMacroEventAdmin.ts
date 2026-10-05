import { MacroEventConflictError, MacroEventNotFoundError } from '../../domain/errors'
import type { MacroEventAdmin, MacroEventDetail } from '../../application/ports/macroEventAdmin'
import type { MacroEventResult } from '../../application/ports/macroEventTrigger'

const REQUEST_TIMEOUT_MS = 4000

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  return body.error ?? fallback
}

export function createEngineMacroEventAdmin(engineUrl: string): MacroEventAdmin {
  // Traduz as recusas do motor pra erros de domínio que o router sabe mapear.
  async function read<T>(res: Response, failure: string): Promise<T> {
    if (res.status === 404) {
      throw new MacroEventNotFoundError(await errorMessage(res, 'evento macro não encontrado'))
    }
    if (res.status === 409) {
      throw new MacroEventConflictError(await errorMessage(res, 'conflito com o estado do evento'))
    }
    if (!res.ok) {
      throw new Error(`${failure} (status ${res.status})`)
    }
    return (await res.json()) as T
  }

  const url = (id: string) => `${engineUrl}/macro-events/${encodeURIComponent(id)}`

  return {
    async detail(eventId, windowDays) {
      const qs = windowDays === undefined ? '' : `?window_days=${windowDays}`
      const res = await fetch(`${url(eventId)}${qs}`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      return read<MacroEventDetail>(res, 'falha ao ler o evento macro no motor de simulação')
    },

    async cancel(eventId) {
      const res = await fetch(url(eventId), {
        method: 'DELETE',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      return read<MacroEventResult>(res, 'falha ao cancelar o evento macro no motor de simulação')
    },
  }
}
