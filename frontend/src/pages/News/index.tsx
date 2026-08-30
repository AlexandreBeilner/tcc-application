import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { NewsEventList } from '../../components/organisms/NewsEventList'
import { useAssetsQuery } from '../../features/market/useAssetsQuery'
import { useNewsQuery } from '../../features/shell/useNewsQuery'
import { markNewsAsSeen } from '../../features/shell/unreadNews'
import { useReportFeedMission } from '../../features/news/useReportFeedMission'
import styles from './index.module.css'

// Tela 5.1 (RF16) — lista cronológica de eventos macro (`GET /news`, mais
// recente primeiro), reforçando "preço reage à expectativa, resultado
// confirma depois" (NewsEventList cuida da distinção visual pendente/
// aplicado). `assetLabels` resolve target.asset_id pra "TICKER · Nome"
// (GET /market/assets, mesmo padrão do Extrato) — busca a lista inteira
// sem filtro de tipo, catálogo pequeno o bastante (15 ativos) pra não
// precisar de lookup individual por target.
export function News() {
    const newsQuery = useNewsQuery()
    const assetsQuery = useAssetsQuery()
    const navigate = useNavigate()
    const reportFeedRead = useReportFeedMission()

    useEffect(() => {
        if (newsQuery.data) markNewsAsSeen(newsQuery.data.events)
    }, [newsQuery.data])

    const assetLabels = useMemo(() => {
        const assets = assetsQuery.data?.assets ?? []
        return Object.fromEntries(assets.map((asset) => [asset.id, `${asset.ticker} · ${asset.name}`]))
    }, [assetsQuery.data])

    return (
        <main className={styles.page}>
            <h1 className={styles.title}>Notícias</h1>
            <p className={styles.subtitle}>
                Eventos de mercado que afetam preço e/ou fundamentos dos ativos — clique num evento pra ver o efeito completo.
            </p>

            {newsQuery.isLoading && <p className={styles.loading}>Carregando feed…</p>}

            {newsQuery.data && (
                <NewsEventList
                    events={newsQuery.data.events}
                    assetLabels={assetLabels}
                    onEventRead={reportFeedRead}
                    onSelectAsset={(assetId) => navigate(`/mercado/ativos/${assetId}`)}
                />
            )}
        </main>
    )
}
