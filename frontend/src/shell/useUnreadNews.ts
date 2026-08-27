import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import { listNews } from '../api/news'
import { getLastSeenNewsId, hasUnreadPendingEvent } from './unreadNews'

// Usado só pelo badge do ícone de notícias (TopBar) — a Feed de Notícias
// em si (5.1) é tarefa 6.6, ainda não implementada.
export function useUnreadNews(): boolean {
  const { token } = useAuth()

  const { data } = useQuery({
    queryKey: ['news', 'badge'],
    queryFn: () => listNews(token as string),
    enabled: token !== null,
  })

  return hasUnreadPendingEvent(data?.events ?? [], getLastSeenNewsId())
}
