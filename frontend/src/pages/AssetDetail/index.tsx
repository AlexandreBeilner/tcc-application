import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PriceChart } from '../../components/organisms/PriceChart'
import { EquityIndicatorsPanel } from '../../components/organisms/EquityIndicatorsPanel'
import { EtfCompositionPanel } from '../../components/organisms/EtfCompositionPanel'
import { FiiIndicatorsPanel } from '../../components/organisms/FiiIndicatorsPanel'
import { DividendHistoryList } from '../../components/organisms/DividendHistoryList'
import { EquityOrderTicket } from '../../components/organisms/EquityOrderTicket'
import { LockedAssetPanel } from '../../components/molecules/LockedAssetPanel'
import { OrderConfirmationDialog } from '../../components/organisms/OrderConfirmationDialog'
import type { OrderDraftOrder } from '../../components/organisms/OrderConfirmationDialog'
import { useAssetQuery } from '../../features/market/useAssetQuery'
import { useAssetQuotesQuery } from '../../features/market/useAssetQuotesQuery'
import { useLockedAssetGate } from '../../features/market/useLockedAssetGate'
import { formatCurrency } from '../../features/portfolio/format'
import { formatSignedPercent } from '../../features/market/format'
import type { OrderSide } from '../../services/market'
import styles from './index.module.css'

const RANGES = [
    { days: 30, label: '30D' },
    { days: 90, label: '3M' },
    { days: 365, label: '1A' },
]

// Tela 4.5 (âncora, mockup vivo em identidade-visual-padroes.md §0) —
// gráfico de preço e fluxo de compra comuns às 3 classes de renda
// variável; a seção de indicadores varia por `asset.type` (RF21, CLAUDE.md:
// nunca reaproveitar o layout de indicadores de Ações pra ETF/FII).
// Ativo travado (tarefa J.3) chega aqui normalmente — `EquityList` não
// redireciona mais pra lição, indicadores/gráfico continuam somente
// leitura (a trava real é só no POST de ordem, RF12/7.0.1) — só o painel
// de compra é trocado pelo banner `LockedAssetPanel`.
export function AssetDetail() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const assetId = id as string

    const assetQuery = useAssetQuery(assetId)
    const [rangeDays, setRangeDays] = useState(RANGES[0].days)
    const quotesQuery = useAssetQuotesQuery(assetId, rangeDays)
    const [draft, setDraft] = useState<OrderDraftOrder | null>(null)
    const gate = useLockedAssetGate()

    const asset = assetQuery.data?.asset

    if (assetQuery.isError) {
        return (
            <main className={styles.page}>
                <p className={styles.error} role="alert">
                    Não foi possível carregar este ativo agora. Tente novamente em instantes.
                </p>
            </main>
        )
    }

    if (!asset) {
        return (
            <main className={styles.page}>
                <p className={styles.loading}>Carregando ativo…</p>
            </main>
        )
    }

    const locked = gate.isLocked(asset)
    const unlockingLesson = gate.unlockingLessonFor(asset)

    function handleSubmitOrder(side: OrderSide, quantity: number) {
        setDraft({
            kind: 'order',
            assetId,
            ticker: asset!.ticker,
            name: asset!.name,
            side,
            quantity,
            unitPrice: asset!.current_price as number,
        })
    }

    return (
        <main className={styles.page}>
            <div className={styles.layout}>
                <div className={styles.main}>
                    <header className={styles.header}>
                        <h1 className={styles.title}>{asset.ticker}</h1>
                        <p className={styles.subtitle}>{asset.name}</p>
                    </header>

                    <div className={styles.priceRow}>
                        {asset.current_price !== undefined ? (
                            <>
                                <span className={`${styles.price} tabular-nums`}>{formatCurrency(asset.current_price)}</span>
                                {asset.daily_change_pct !== undefined && (
                                    <span className={[styles.change, asset.daily_change_pct >= 0 ? styles.gain : styles.loss].join(' ')}>
                                        {formatSignedPercent(asset.daily_change_pct)}
                                    </span>
                                )}
                            </>
                        ) : (
                            <span className={styles.awaitingQuote}>Aguardando primeira cotação</span>
                        )}
                    </div>

                    <PriceChart
                        quotes={quotesQuery.data?.quotes ?? []}
                        ranges={RANGES}
                        activeDays={rangeDays}
                        onRangeChange={setRangeDays}
                    />

                    {asset.equity && (
                        <>
                            <EquityIndicatorsPanel indicators={asset.equity.indicators} />
                            <button
                                type="button"
                                className={styles.companyLink}
                                onClick={() => navigate(`/mercado/empresas/${asset.equity!.company.id}`)}
                            >
                                Ver empresa: {asset.equity.company.name}
                            </button>
                            <section className={styles.dividends}>
                                <span className={styles.dividendsTitle}>Histórico de proventos</span>
                                <DividendHistoryList history={asset.equity.dividend_history} />
                            </section>
                        </>
                    )}

                    {asset.etf && <EtfCompositionPanel etf={asset.etf} />}

                    {asset.fii && (
                        <>
                            <FiiIndicatorsPanel fii={asset.fii} />
                            <section className={styles.dividends}>
                                <span className={styles.dividendsTitle}>Histórico de proventos</span>
                                <DividendHistoryList history={asset.fii.dividend_history} />
                            </section>
                        </>
                    )}
                </div>

                <aside className={styles.sidebar}>
                    {locked ? (
                        <LockedAssetPanel lessonId={unlockingLesson?.id} lessonCode={unlockingLesson?.code} />
                    ) : (
                        <EquityOrderTicket unitPrice={asset.current_price} onSubmit={handleSubmitOrder} />
                    )}
                </aside>
            </div>

            {draft && <OrderConfirmationDialog draft={draft} onClose={() => setDraft(null)} />}
        </main>
    )
}
