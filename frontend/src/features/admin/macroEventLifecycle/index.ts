import { ApiError } from '../../../services/client'
import type { MacroEventBase, MacroEventFilters, MacroEventStatus } from '../../../services/admin'

// Situação de um evento no painel: o status do motor mais "agendado", que é só um pendente
// cujo primeiro dia de efeito ainda não chegou (`scheduled`).
export type MacroEventPhase = 'agendado' | MacroEventStatus

export const PHASE_LABELS: Record<MacroEventPhase, string> = {
    agendado: 'Agendado',
    pendente: 'Pendente',
    aplicado: 'Aplicado',
    cancelado: 'Cancelado',
}

export function phaseOf(event: Pick<MacroEventBase, 'status' | 'scheduled'>): MacroEventPhase {
    return event.status === 'pendente' && event.scheduled ? 'agendado' : event.status
}

export const STATUS_FILTER_OPTIONS: Array<{ value: '' | MacroEventStatus; label: string }> = [
    { value: '', label: 'Todos os status' },
    { value: 'pendente', label: 'Pendentes (inclui agendados)' },
    { value: 'aplicado', label: 'Aplicados' },
    { value: 'cancelado', label: 'Cancelados' },
]

export type TargetFilterKind = '' | 'sector' | 'risk_class' | 'asset_id'

// Estado dos campos de filtro da tela; texto cru, convertido por `buildMacroEventFilters`.
export interface MacroEventFilterDraft {
    status: '' | MacroEventStatus
    targetKind: TargetFilterKind
    targetValue: string
    fromDay: string
    toDay: string
}

export const EMPTY_FILTER_DRAFT: MacroEventFilterDraft = { status: '', targetKind: '', targetValue: '', fromDay: '', toDay: '' }

function parseDay(raw: string): number | 'invalid' | undefined {
    const trimmed = raw.trim()
    if (trimmed === '') return undefined
    return /^\d+$/.test(trimmed) ? Number(trimmed) : 'invalid'
}

// Converte o rascunho nos filtros da API; `error` explica por que o período não vale.
export function buildMacroEventFilters(draft: MacroEventFilterDraft): { filters: MacroEventFilters; error?: string } {
    const filters: MacroEventFilters = {}
    if (draft.status !== '') filters.status = draft.status
    if (draft.targetKind !== '' && draft.targetValue !== '') filters[draft.targetKind] = draft.targetValue

    const from = parseDay(draft.fromDay)
    const to = parseDay(draft.toDay)
    if (from === 'invalid' || to === 'invalid') return { filters, error: 'Os dias do período precisam ser números inteiros.' }
    if (from !== undefined && to !== undefined && from > to) return { filters, error: 'O dia inicial não pode ser maior que o final.' }
    if (from !== undefined) filters.from_day = from
    if (to !== undefined) filters.to_day = to
    return { filters }
}

// Mensagens fixas por situação conhecida; o 409 traz o motivo do motor (já aplicado,
// efeito em andamento, tick em andamento), que é o que o admin precisa ler.
export function describeCancelError(err: unknown): string {
    if (err instanceof ApiError) {
        if (err.status === 409) return `Não foi possível cancelar: ${err.message}.`
        if (err.status === 404) return 'Esse evento não existe mais.'
    }
    return 'Não foi possível cancelar agora. Confira o histórico e a auditoria antes de tentar de novo.'
}

// Mensagem do disparo agendado (400 do motor traz o motivo, como "o dia de aplicação precisa
// ser posterior ao dia simulado atual").
export function describeTriggerError(err: unknown): string | null {
    if (err instanceof ApiError) return err.message
    return err ? 'Não foi possível disparar o evento agora. Tente novamente.' : null
}
