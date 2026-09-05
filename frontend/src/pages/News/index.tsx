import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pagination } from '../../components/molecules/Pagination'
import { NewsEventList } from '../../components/organisms/NewsEventList'
import { useAssetLabels } from '../../features/market/useAssetLabels'
import { useAssetsQuery } from '../../features/market/useAssetsQuery'
import { useMarkNewsEventSeenMutation } from '../../features/news/useMarkNewsEventSeenMutation'
import { useNewsFeedQuery } from '../../features/news/useNewsFeedQuery'
import { markNewsAsSeen } from '../../features/shell/unreadNews'
import { useReportFeedMission } from '../../features/news/useReportFeedMission'
import styles from './index.module.css'

// Tela 5.1 (RF16) — lista cronológica de eventos macro (`GET /news`, mais
// recente primeiro), reforçando "preço reage à expectativa, resultado
// confirma depois" (NewsEventList cuida da distinção visual pendente/
// aplicado). `assetLabels` resolve target.asset_id pra "TICKER · Nome"
// (GET /market/assets, mesmo padrão do Extrato) — busca a lista inteira
// sem filtro de tipo, catálogo pequeno o bastante (15 ativos) pra não
// precisar de lookup individual por target. Paginação numerada (tarefa
// 6.9.9, `useNewsFeedQuery`/`Pagination`) — trocou "Carregar mais"
// (decisão original da 6.6.1) pro mesmo padrão de Amigos/Solicitações/
// Classificação, a pedido do autor. `onEventOpen` marca "visto" persistido
// por usuário na primeira expansão de um evento ainda não visto (tarefa
// 6.6.2, `POST /news/:id/seen`) — diferente de `markNewsAsSeen` abaixo,
// que continua sendo só o agregado client-side do sino da TopBar
// (NewsBell/useUnreadNews), sem mudança nesta tarefa.
export function News() {
    const [page, setPage] = useState(1)
    const newsQuery = useNewsFeedQuery(page)
    const assetsQuery = useAssetsQuery()
    const navigate = useNavigate()
    const reportFeedRead = useReportFeedMission()
    const markEventSeen = useMarkNewsEventSeenMutation()

    const events = useMemo(() => newsQuery.data?.events ?? [], [newsQuery.data])

    useEffect(() => {
        // Só a página 1 contém os eventos mais recentes de fato (lista
        // sempre `created_at DESC`) — marcar "visto" a partir de uma página
        // mais antiga moveria `lastSeenId` pra trás e reacenderia o badge
        // pra eventos pendentes já vistos entre o mais recente real e este.
        if (newsQuery.data && page === 1) markNewsAsSeen(events)
    }, [newsQuery.data, events, page])

    const assetLabels = useAssetLabels(assetsQuery.data?.assets)

    return (
        <main className={styles.page}>
            <h1 className={styles.title}>Notícias</h1>
            <p className={styles.subtitle}>
                Eventos de mercado que afetam preço e/ou fundamentos dos ativos. Clique num evento pra ver o efeito completo.
            </p>

            {newsQuery.isLoading && <p className={styles.loading}>Carregando feed…</p>}

            {newsQuery.data && (
                <>
                    <NewsEventList
                        events={events}
                        assetLabels={assetLabels}
                        onEventRead={reportFeedRead}
                        onEventOpen={(eventId) => markEventSeen.mutate(eventId)}
                        onSelectAsset={(assetId) => navigate(`/mercado/ativos/${assetId}`)}
                    />

                    <Pagination
                        page={newsQuery.data.page}
                        totalPages={newsQuery.data.totalPages}
                        onPageChange={setPage}
                        ariaLabel="Paginação do feed de notícias"
                    />
                </>
            )}
        </main>
    )
}
