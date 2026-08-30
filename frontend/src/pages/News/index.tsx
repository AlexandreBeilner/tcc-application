import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/atoms/Button'
import { NewsEventList } from '../../components/organisms/NewsEventList'
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
// precisar de lookup individual por target. Paginação real via "Carregar
// mais" (tarefa 6.6.1, `useNewsFeedQuery`) — some quando a última página
// vier menor que o tamanho pedido (fim da lista). `onEventOpen` marca
// "visto" persistido por usuário na primeira expansão de um evento ainda
// não visto (tarefa 6.6.2, `POST /news/:id/seen`) — diferente de
// `markNewsAsSeen` abaixo, que continua sendo só o agregado client-side do
// sino da TopBar (NewsBell/useUnreadNews), sem mudança nesta tarefa.
export function News() {
    const newsQuery = useNewsFeedQuery()
    const assetsQuery = useAssetsQuery()
    const navigate = useNavigate()
    const reportFeedRead = useReportFeedMission()
    const markEventSeen = useMarkNewsEventSeenMutation()

    const events = useMemo(() => newsQuery.data?.pages.flatMap((page) => page.events) ?? [], [newsQuery.data])

    useEffect(() => {
        if (newsQuery.data) markNewsAsSeen(events)
    }, [newsQuery.data, events])

    const assetLabels = useMemo(() => {
        const assets = assetsQuery.data?.assets ?? []
        return Object.fromEntries(assets.map((asset) => [asset.id, `${asset.ticker} · ${asset.name}`]))
    }, [assetsQuery.data])

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

                    {newsQuery.hasNextPage && (
                        <Button
                            variant="secondary"
                            className={styles.loadMore}
                            disabled={newsQuery.isFetchingNextPage}
                            onClick={() => newsQuery.fetchNextPage()}
                        >
                            {newsQuery.isFetchingNextPage ? 'Carregando…' : 'Carregar mais'}
                        </Button>
                    )}
                </>
            )}
        </main>
    )
}
