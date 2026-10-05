import { EngineSettingNotFoundError, EngineSettingRejectedError } from '../../domain/errors'
import type {
  EngineSettings,
  EngineSettingsAdmin,
} from '../../application/ports/engineSettingsAdmin'

const REQUEST_TIMEOUT_MS = 4000

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  return body.error ?? fallback
}

export function createEngineSettingsAdmin(engineUrl: string): EngineSettingsAdmin {
  // Traduz as recusas do motor pra erros de domínio que o router sabe mapear.
  async function readSettings(res: Response, failure: string): Promise<EngineSettings> {
    if (res.status === 404) {
      throw new EngineSettingNotFoundError(await errorMessage(res, 'parâmetro não encontrado'))
    }
    if (res.status === 422) {
      throw new EngineSettingRejectedError(await errorMessage(res, 'valor recusado pelo motor'))
    }
    if (!res.ok) {
      throw new Error(`${failure} (status ${res.status})`)
    }
    return (await res.json()) as EngineSettings
  }

  const url = (key: string) => `${engineUrl}/admin/settings/${encodeURIComponent(key)}`

  return {
    async list() {
      const res = await fetch(`${engineUrl}/admin/settings`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      return readSettings(res, 'falha ao ler os parâmetros no motor de simulação')
    },

    async set(key, value, adminId) {
      const res = await fetch(url(key), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value, admin_id: adminId }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      return readSettings(res, 'falha ao gravar o parâmetro no motor de simulação')
    },

    async reset(key) {
      const res = await fetch(url(key), {
        method: 'DELETE',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      return readSettings(res, 'falha ao restaurar o parâmetro no motor de simulação')
    },
  }
}
