import { IntegrityAlreadyRunningError } from '../../domain/errors'
import type { IntegrityAdmin, IntegrityRun } from '../../application/ports/integrityAdmin'

const REQUEST_TIMEOUT_MS = 4000

export function createEngineIntegrityAdmin(engineUrl: string): IntegrityAdmin {
  return {
    async start(): Promise<IntegrityRun> {
      const res = await fetch(`${engineUrl}/admin/integrity/check`, {
        method: 'POST',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (res.status === 409) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new IntegrityAlreadyRunningError(
          body.error ?? 'já existe uma verificação de integridade em andamento',
        )
      }
      if (!res.ok) {
        throw new Error(
          `falha ao iniciar a verificação de integridade no motor (status ${res.status})`,
        )
      }
      return (await res.json()) as IntegrityRun
    },

    async latest(): Promise<IntegrityRun | null> {
      const res = await fetch(`${engineUrl}/admin/integrity/check`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (!res.ok) {
        throw new Error(`falha ao ler a verificação de integridade no motor (status ${res.status})`)
      }
      const body = (await res.json()) as { run: IntegrityRun | null }
      return body.run
    },
  }
}
