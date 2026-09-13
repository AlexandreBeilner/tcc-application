import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { FixedIncomeSimulator } from '../../components/organisms/FixedIncomeSimulator'
import { Button } from '../../components/atoms/Button'
import { LockedAssetPanel } from '../../components/molecules/LockedAssetPanel'
import { OrderConfirmationDialog } from '../../components/organisms/OrderConfirmationDialog'
import type { OrderDraftFixedIncomePurchase, OrderDraftFixedIncomeRedemption } from '../../components/organisms/OrderConfirmationDialog'
import { useAssetQuery } from '../../features/market/useAssetQuery'
import { useLockedAssetGate } from '../../features/market/useLockedAssetGate'
import { useSimulateFixedIncomeQuery } from '../../features/market/useSimulateFixedIncomeQuery'
import { useMyAccountQuery } from '../../features/portfolio/useMyAccountQuery'
import { daysUntil } from '../../features/market/daysUntil'
import { formatRatePercent } from '../../features/market/format'
import styles from './index.module.css'

const DEFAULT_DAYS_HELD = 365
const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

// Tela 4.3 — permite simular o aporte antes de confirmar (inventário:
// "aprender fazendo mesmo fora da lição guiada"). `days_held` da simulação
// é sempre o prazo até o vencimento (`maturity_date`), pra a projeção
// mostrar "quanto rende se eu segurar até lá" — o usuário não escolhe esse
// número nesta tela, só o valor do aporte. Produto travado (Fase Q) vira
// parede total, mesmo tratamento de `AssetDetail` — até então esta tela não
// checava `useLockedAssetGate` nenhuma vez (gap real: clicar num produto
// travado na grid de `FixedIncomeList` chegava aqui com o simulador/CTA de
// investir 100% funcionais, sem trava nenhuma além do 403 do backend no
// POST de aporte).
export function FixedIncomeDetail() {
    const { id } = useParams<{ id: string }>()
    const assetId = id as string

    const assetQuery = useAssetQuery(assetId)
    const accountQuery = useMyAccountQuery()
    const gate = useLockedAssetGate()
    const [amount, setAmount] = useState(0)
    const [draft, setDraft] = useState<OrderDraftFixedIncomePurchase | OrderDraftFixedIncomeRedemption | null>(null)

    const asset = assetQuery.data?.asset
    const fixedIncome = asset?.fixed_income
    const daysHeld = fixedIncome?.maturity_date ? daysUntil(fixedIncome.maturity_date) : DEFAULT_DAYS_HELD
    const simulateQuery = useSimulateFixedIncomeQuery(assetId, amount, daysHeld)

    const existingPosition = accountQuery.data?.fixedIncomePositions.find((position) => position.assetId === assetId)

    if (assetQuery.isError) {
        return (
            <main className={styles.page}>
                <p className={styles.error} role="alert">
                    Não foi possível carregar este produto agora. Tente novamente em instantes.
                </p>
            </main>
        )
    }

    if (!asset || !fixedIncome) {
        return (
            <main className={styles.page}>
                <p className={styles.loading}>Carregando produto…</p>
            </main>
        )
    }

    if (gate.isLocked(asset)) {
        const unlockingLesson = gate.unlockingLessonFor(asset)
        return (
            <main className={styles.page}>
                <LockedAssetPanel lessonId={unlockingLesson?.id} lessonTitle={unlockingLesson?.title} reachable={unlockingLesson?.reachable} />
            </main>
        )
    }

    function handleInvest() {
        setDraft({
            kind: 'fixed_income_purchase',
            assetId,
            ticker: asset!.ticker,
            name: asset!.name,
            amount,
            projected: simulateQuery.data,
        })
    }

    function handleRedeem() {
        setDraft({ kind: 'fixed_income_redemption', assetId, ticker: asset!.ticker, name: asset!.name })
    }

    return (
        <main className={styles.page}>
            <div className={styles.layout}>
                <div className={styles.main}>
                    <header className={styles.header}>
                        <h1 className={styles.title}>{asset.ticker}</h1>
                        <p className={styles.subtitle}>{asset.name}</p>
                    </header>

                    <section className={styles.info}>
                        {fixedIncome.interest_rate !== undefined && (
                            <div className={styles.infoRow}>
                                <span className={styles.infoLabel}>Taxa</span>
                                <span className={styles.infoValue}>{formatRatePercent(fixedIncome.interest_rate)} a.a.</span>
                            </div>
                        )}
                        {fixedIncome.maturity_date && (
                            <div className={styles.infoRow}>
                                <span className={styles.infoLabel}>Vencimento</span>
                                <span className={styles.infoValue}>{dateFormatter.format(new Date(fixedIncome.maturity_date))}</span>
                            </div>
                        )}
                        <div className={styles.infoRow}>
                            <span className={styles.infoLabel}>Emissor</span>
                            <span className={styles.infoValue}>{fixedIncome.issuer_type}</span>
                        </div>
                        {fixedIncome.credit_risk_rating && (
                            <div className={styles.infoRow}>
                                <span className={styles.infoLabel}>Risco de crédito</span>
                                <span className={styles.infoValue}>{fixedIncome.credit_risk_rating}</span>
                            </div>
                        )}
                        <div className={styles.badges}>{fixedIncome.tax_exempt && <span className={styles.badge}>Isento de IR</span>}</div>
                    </section>

                    <p className={styles.warning}>
                        Resgatar antes do vencimento marca a posição a mercado: se a taxa de mercado subir depois da sua compra, o valor de
                        resgate pode ficar abaixo do que você aportou.
                    </p>

                    {existingPosition && (
                        <section className={styles.position}>
                            <span className={styles.positionLabel}>Sua posição: {existingPosition.quantity.toFixed(2)} unidades</span>
                            <Button variant="secondary" onClick={handleRedeem}>
                                Resgatar
                            </Button>
                        </section>
                    )}
                </div>

                <div className={styles.sidebar}>
                    <FixedIncomeSimulator
                        minimumInvestment={fixedIncome.minimum_investment}
                        amount={amount}
                        onAmountChange={setAmount}
                        simulation={simulateQuery.data}
                        onInvest={handleInvest}
                    />
                </div>
            </div>

            {draft && <OrderConfirmationDialog draft={draft} onClose={() => setDraft(null)} />}
        </main>
    )
}
