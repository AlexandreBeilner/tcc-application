import { useEffect } from 'react'
import { useNewsQuery } from '../features/shell/useNewsQuery'
import { markNewsAsSeen } from '../features/shell/unreadNews'

// Conteúdo completo do Feed de Notícias (tela 5.1) é a tarefa 6.6 — aqui
// só existe o suficiente pra marcar a visita ao feed, zerando o badge de
// novidade da TopBar (tarefa 6.1). `useNewsQuery` é a mesma query de
// `useUnreadNews` (TopBar/NewsBell) — compartilha o cache em vez de
// disparar uma segunda chamada a `GET /news`.
export function News() {
    const { data } = useNewsQuery()

    useEffect(() => {
        if (data) markNewsAsSeen(data.events)
    }, [data])

    return (
        <div>
            <h1>Notícias</h1>
        </div>
    )
}
