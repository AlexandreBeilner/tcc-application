import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PriceChart } from '../../components/organisms/PriceChart'
import { EquityIndicatorsPanel } from '../../components/organisms/EquityIndicatorsPanel'
import { EtfCompositionPanel } from '../../components/organisms/EtfCompositionPanel'
import { FiiIndicatorsPanel } from '../../components/organisms/FiiIndicatorsPanel'
import { DividendHistoryList } from '../../components/organisms/DividendHistoryList'
import { PositionSummaryCard } from '../../components/organisms/PositionSummaryCard'
import { EquityOrderTicket } from '../../components/organisms/EquityOrderTicket'
import { LockedGate } from '../../components/organisms/LockedGate'
import { OrderConfirmationDialog } from '../../components/organisms/OrderConfirmationDialog'
import type { OrderDraftOrder } from '../../components/organisms/OrderConfirmationDialog'
import { useAssetQuery } from '../../features/market/useAssetQuery'
import { useAssetBookQuery } from '../../features/market/useAssetBookQuery'
import { useMarketClosedReason } from '../../features/market/useMarketClosedReason'
import { useTradingHaltReason } from '../../features/market/useTradingHaltQuery'
import { useAssetQuotesQuery } from '../../features/market/useAssetQuotesQuery'
import { useLockedAssetGate } from '../../features/market/useLockedAssetGate'
import { DividendOnHoldNotice } from '../../components/molecules/DividendOnHoldNotice'
import { useMyAccountQuery } from '../../features/portfolio/useMyAccountQuery'
import { formatCurrency } from '../../features/portfolio/format'
import type { OrderSide } from '../../services/market'
import { Delta } from '../../components/atoms/Delta'
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
// Ativo travado (Fase Q, reversão da J.3 "prévia, não parede") chega aqui
// pelo clique na linha de `EquityList` — mas a tela inteira vira parede:
// nada de ticker/preço/gráfico/indicadores, só o card `LockedGate`
// explicando o que falta pra liberar. A versão original da J.3 mantinha
// tudo visível (só leitura) e trocava apenas o painel de compra — decisão
// revertida pelo autor (2026-09-12): "a única coisa que aparece na tela é
// o card, até liberar".
export function AssetDetail() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const assetId = id as string

    const assetQuery = useAssetQuery(assetId)
    const bookQuery = useAssetBookQuery(assetId)
    const accountQuery = useMyAccountQuery()
    const [rangeDays, setRangeDays] = useState(RANGES[0].days)
    const quotesQuery = useAssetQuotesQuery(assetId, rangeDays)
    const [draft, setDraft] = useState<OrderDraftOrder | null>(null)
    const gate = useLockedAssetGate()

    const asset = assetQuery.data?.asset
    // Mercado fechado (fim de semana) ou negociação pausada pela administração: os dois
    // desabilitam a ordem com o motivo em texto, o de calendário primeiro.
    const marketClosedReason = useMarketClosedReason(asset?.is_sandbox ?? false)
    const haltReason = useTradingHaltReason(assetId, asset?.is_sandbox ?? false)
    const closedReason = marketClosedReason ?? haltReason
    // Book real (tarefa S.5/S.7) — insumo do custo estimado e de "Usar o
    // máximo" do `EquityOrderTicket`; ausente/sandbox cai no fallback de
    // sempre (último negócio), já tratado no próprio componente.
    const position = accountQuery.data?.positions.find((position) => position.assetId === assetId)
    const ownedQuantity = position?.quantity

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

    if (locked) {
        return (
            <LockedGate
                variant="section"
                lessonId={unlockingLesson?.id}
                lessonTitle={unlockingLesson?.title}
                reachable={unlockingLesson?.reachable}
            />
        )
    }

    function handleSubmitOrder(side: OrderSide, quantity: number) {
        setDraft({
            kind: 'order',
            assetId,
            ticker: asset!.ticker,
            name: asset!.name,
            isSandbox: asset!.is_sandbox,
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
                                    <Delta percent={asset.daily_change_pct} className={styles.change} />
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

                    {/* `positions` nunca é deletada numa venda total (UPSERT no motor,
                        `order_execution_repository.go`) — a linha fica com `quantity: 0` e
                        `average_price` do último preço médio, então `position.quantity > 0`
                        é obrigatório aqui: sem essa checagem o card apareceria pra um ativo
                        que o usuário não tem mais, dividindo por `averagePrice * 0` no
                        retorno total (tarefa S.16, achado revisado nesta sessão). */}
                    {position && !position.isSandbox && position.quantity > 0 && (
                        <PositionSummaryCard
                            quantity={position.quantity}
                            averagePrice={position.averagePrice}
                            markPrice={position.markPrice}
                            dividendsReceived={position.dividendsReceived}
                        />
                    )}

                    {asset.equity && (
                        <>
                            <DividendOnHoldNotice companyId={asset.equity.company.id} />
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

                    {asset.etf && (
                        <>
                            <EtfCompositionPanel etf={asset.etf} />
                            <section className={styles.dividends}>
                                <span className={styles.dividendsTitle}>Proventos distribuídos</span>
                                <DividendHistoryList history={asset.etf.dividend_history} />
                            </section>
                        </>
                    )}

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
                    <EquityOrderTicket
                        unitPrice={asset.current_price}
                        book={bookQuery.data?.book}
                        cashBalance={accountQuery.data?.cashBalance}
                        ownedQuantity={ownedQuantity}
                        closedReason={closedReason}
                        onSubmit={handleSubmitOrder}
                    />
                </aside>
            </div>

            {draft && <OrderConfirmationDialog draft={draft} onClose={() => setDraft(null)} />}
        </main>
    )
}
