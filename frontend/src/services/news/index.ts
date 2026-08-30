import { apiRequest } from '../client'
import type { ListNewsResult } from './types'

export type { NewsEvent, NewsEventTarget, ListNewsResult } from './types'

export function listNews(token: string, limit?: number, offset?: number): Promise<ListNewsResult> {
    const params = new URLSearchParams()
    if (limit !== undefined) params.set('limit', String(limit))
    if (offset !== undefined) params.set('offset', String(offset))
    const query = params.toString()
    return apiRequest<ListNewsResult>(`/news${query ? `?${query}` : ''}`, { token })
}

// Idempotente (`.docs/backend/news.md`) — reenviar não duplica linha nem
// lança erro, mesmo padrão de `completeMission`.
export function markNewsEventSeen(token: string, eventId: string): Promise<void> {
    return apiRequest<void>(`/news/${eventId}/seen`, { token, method: 'POST' })
}
