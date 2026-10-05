import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { listMacroEvents } from '../../../services/admin'
import type { MacroEvent, MacroEventFilters } from '../../../services/admin'

// Mesmo default de paginação do motor (defaultMacroEventListLimit) e
// mesma migração "Carregar mais" → paginação numerada já feita no Feed de
// Notícias (`useNewsFeedQuery`, tarefa 6.9.9) — Painel Admin (10.1) ganhou
// de graça (`.docs/engine/macroevent.md#get-macro-events`).
export const MACRO_EVENTS_PAGE_SIZE = 20

export const MACRO_EVENTS_QUERY_KEY = ['admin', 'macro-events'] as const

export interface MacroEventsPage {
    events: MacroEvent[]
    page: number
    pageSize: number
    totalEntries: number
    totalPages: number
}

export function useMacroEventsQuery(page: number, filters: MacroEventFilters = {}): UseQueryResult<MacroEventsPage> {
    const { token } = useAuth()

    return useQuery({
        queryKey: [...MACRO_EVENTS_QUERY_KEY, page, filters] as const,
        queryFn: async () => {
            const offset = (page - 1) * MACRO_EVENTS_PAGE_SIZE
            const result = await listMacroEvents(token as string, MACRO_EVENTS_PAGE_SIZE, offset, filters)
            return {
                events: result.events,
                page,
                pageSize: MACRO_EVENTS_PAGE_SIZE,
                totalEntries: result.total_entries,
                totalPages: Math.max(1, Math.ceil(result.total_entries / MACRO_EVENTS_PAGE_SIZE)),
            }
        },
        enabled: token !== null,
    })
}
