import { EngineSettingNotFoundError, EngineSettingRejectedError } from '../../domain/errors'
import type {
  EngineSettings,
  EngineSettingsAdmin,
} from '../../application/ports/engineSettingsAdmin'

const REQUEST_TIMEOUT_MS = 4000

// Parâmetros que a tela de Tempo (10.11) sabe mostrar. O motor também guarda os parâmetros da
// Assembleia de Acionistas (`governance_*`, MO.6.2); eles só aparecem no painel quando a
// MO.6.8 lhes der tela e texto, então ficam fora da listagem por enquanto.
const PANEL_KEYS: ReadonlySet<string> = new Set(['ticks_per_day', 'max_catch_up'])

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
    const settings = (await res.json()) as EngineSettings
    return { ...settings, editable: settings.editable.filter((s) => PANEL_KEYS.has(s.key)) }
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
