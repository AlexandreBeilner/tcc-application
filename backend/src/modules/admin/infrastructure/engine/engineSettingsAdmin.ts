import { EngineSettingNotFoundError, EngineSettingRejectedError } from '../../domain/errors'
import type {
  EngineSettingGroup,
  EngineSettings,
  EngineSettingsAdmin,
} from '../../application/ports/engineSettingsAdmin'

const REQUEST_TIMEOUT_MS = 4000

// Cada tela do painel sabe mostrar um grupo de parâmetros: a de Tempo (10.11) o ritmo do
// Temporizador, a das Assembleias (MO.6.8) a governança (`governance_*`, MO.6.2). O motor devolve
// tudo junto; o filtro garante que uma tela nunca receba chave que não sabe nomear.
const GROUP_KEYS: Record<EngineSettingGroup, ReadonlySet<string>> = {
  pace: new Set(['ticks_per_day', 'max_catch_up']),
  governance: new Set([
    'governance_growth_step_centipp',
    'governance_quality_step_centi',
    'governance_ramp_ticks',
    'governance_cooldown_days',
    'governance_payout_step_centipp',
    'governance_payout_min_pct',
    'governance_payout_max_pct',
    'governance_payout_cooldown_days',
    'governance_premium_step_centipp',
    'governance_premium_min_pct',
    'governance_premium_max_pct',
    'governance_hold_declarations',
    'governance_declaration_safety_days',
  ]),
}

function groupOf(key: string): EngineSettingGroup {
  return GROUP_KEYS.governance.has(key) ? 'governance' : 'pace'
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  return body.error ?? fallback
}

export function createEngineSettingsAdmin(engineUrl: string): EngineSettingsAdmin {
  // Traduz as recusas do motor pra erros de domínio que o router sabe mapear.
  async function readSettings(
    res: Response,
    failure: string,
    group: EngineSettingGroup,
  ): Promise<EngineSettings> {
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
    return { ...settings, editable: settings.editable.filter((s) => GROUP_KEYS[group].has(s.key)) }
  }

  const url = (key: string) => `${engineUrl}/admin/settings/${encodeURIComponent(key)}`

  return {
    async list(group = 'pace') {
      const res = await fetch(`${engineUrl}/admin/settings`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      return readSettings(res, 'falha ao ler os parâmetros no motor de simulação', group)
    },

    async set(key, value, adminId) {
      const res = await fetch(url(key), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value, admin_id: adminId }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      return readSettings(res, 'falha ao gravar o parâmetro no motor de simulação', groupOf(key))
    },

    async reset(key) {
      const res = await fetch(url(key), {
        method: 'DELETE',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      return readSettings(res, 'falha ao restaurar o parâmetro no motor de simulação', groupOf(key))
    },
  }
}
