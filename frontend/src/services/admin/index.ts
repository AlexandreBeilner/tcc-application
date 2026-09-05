import { apiRequest } from '../client'
import type { ListMacroEventsResult, TriggerMacroEventInput, TriggerMacroEventResult } from './types'

export type {
    MacroEvent,
    MacroEventBase,
    MacroEventDirection,
    MacroEventMagnitudeBand,
    MacroEventStatus,
    ListMacroEventsResult,
    NewsEventTarget,
    TriggerMacroEventAdHocInput,
    TriggerMacroEventFromTemplateInput,
    TriggerMacroEventInput,
    TriggerMacroEventResult,
} from './types'

// Tela 10.1 (`.docs/backend/admin.md#get-adminmacro-events`) — mesma
// convenção limit/offset de `listNews`.
export function listMacroEvents(token: string, limit?: number, offset?: number): Promise<ListMacroEventsResult> {
    const params = new URLSearchParams()
    if (limit !== undefined) params.set('limit', String(limit))
    if (offset !== undefined) params.set('offset', String(offset))
    const query = params.toString()
    return apiRequest<ListMacroEventsResult>(`/admin/macro-events${query ? `?${query}` : ''}`, { token })
}

// Tela 10.2 (`.docs/backend/admin.md#post-adminmacro-events`) — `input` já
// é uma das duas variantes válidas do schema Zod do backend, resolvidas no
// client antes de chamar esta função (`MacroEventTriggerForm`).
export function triggerMacroEvent(token: string, input: TriggerMacroEventInput): Promise<TriggerMacroEventResult> {
    return apiRequest<TriggerMacroEventResult>('/admin/macro-events', { token, method: 'POST', body: input })
}
