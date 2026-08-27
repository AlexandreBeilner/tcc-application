import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import { listNews } from '../api/news'
import { markNewsAsSeen } from '../shell/unreadNews'

// Conteúdo completo do Feed de Notícias (tela 5.1) é a tarefa 6.6 — aqui
// só existe o suficiente pra marcar a visita ao feed, zerando o badge de
// novidade da TopBar (tarefa 6.1). Mesma queryKey de `useUnreadNews`
// (TopBar/NewsBell) de propósito — compartilha o cache da mesma query em
// vez de disparar uma segunda chamada a `GET /news`.
export function News() {
  const { token } = useAuth()
  const { data } = useQuery({
    queryKey: ['news', 'badge'],
    queryFn: () => listNews(token as string),
    enabled: token !== null,
  })

  useEffect(() => {
    if (data) markNewsAsSeen(data.events)
  }, [data])

  return (
    <div>
      <h1>Notícias</h1>
    </div>
  )
}
