import { useSyncExternalStore } from 'react'
import { useNewsQuery } from './useNewsQuery'
import { getLastSeenNewsId, hasUnreadPendingEvent, subscribeToLastSeenNewsId } from './unreadNews'

// Usado só pelo badge do ícone de notícias (TopBar) — a Feed de Notícias
// em si (5.1) é tarefa 6.6, ainda não implementada.
export function useUnreadNews(): boolean {
    const { data } = useNewsQuery()
    // `useSyncExternalStore`, não uma leitura direta de `getLastSeenNewsId()`
    // no corpo do hook: localStorage é estado externo ao React, então uma
    // leitura direta só reflete a visita mais recente no próximo render que
    // já ia acontecer por outro motivo — este hook reassina o valor toda vez
    // que `markNewsAsSeen` notifica (ver `unreadNews.ts`).
    const lastSeenId = useSyncExternalStore(subscribeToLastSeenNewsId, getLastSeenNewsId)

    return hasUnreadPendingEvent(data?.events ?? [], lastSeenId)
}
