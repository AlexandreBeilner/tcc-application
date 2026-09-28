import { TickInProgressError } from '../../domain/errors'
import type { TickResult, TickTrigger } from '../../application/ports/tickTrigger'

export function createEngineTickTrigger(engineUrl: string): TickTrigger {
  return {
    async run(): Promise<TickResult> {
      const res = await fetch(`${engineUrl}/admin/tick`, { method: 'POST' })

      // 409 é "já existe um tick em andamento" (trava consultiva do motor,
      // tarefa S.3) — traduzido pra erro de domínio que o router mapeia de
      // volta pra 409, mesmo raciocínio do 400 em engineMacroEventTrigger.
      if (res.status === 409) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new TickInProgressError(body.error ?? 'já existe um tick em andamento')
      }
      if (!res.ok) {
        throw new Error(`falha ao executar tick no motor de simulação (status ${res.status})`)
      }

      return (await res.json()) as TickResult
    },
  }
}
