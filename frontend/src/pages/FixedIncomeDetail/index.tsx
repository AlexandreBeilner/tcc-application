import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { FixedIncomeSimulator } from '../../components/organisms/FixedIncomeSimulator'
import { Button } from '../../components/atoms/Button'
import { useAssetQuery } from '../../features/market/useAssetQuery'
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
// número nesta tela, só o valor do aporte.
export function FixedIncomeDetail() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const assetId = id as string

    const assetQuery = useAssetQuery(assetId)
    const accountQuery = useMyAccountQuery()
    const [amount, setAmount] = useState(0)

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

    function handleInvest() {
        navigate('/mercado/confirmar', {
            state: {
                kind: 'fixed_income_purchase',
                assetId,
                ticker: asset!.ticker,
                name: asset!.name,
                amount,
                projected: simulateQuery.data,
            },
        })
    }

    function handleRedeem() {
        navigate('/mercado/confirmar', {
            state: { kind: 'fixed_income_redemption', assetId, ticker: asset!.ticker, name: asset!.name },
        })
    }

    return (
        <main className={styles.page}>
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
                Resgatar antes do vencimento marca a posição a mercado: se a taxa de mercado subir depois da sua compra, o valor de resgate
                pode ficar abaixo do que você aportou.
            </p>

            {existingPosition && (
                <section className={styles.position}>
                    <span className={styles.positionLabel}>Sua posição: {existingPosition.quantity.toFixed(2)} unidades</span>
                    <Button variant="secondary" onClick={handleRedeem}>
                        Resgatar
                    </Button>
                </section>
            )}

            <FixedIncomeSimulator
                minimumInvestment={fixedIncome.minimum_investment}
                amount={amount}
                onAmountChange={setAmount}
                simulation={simulateQuery.data}
                onInvest={handleInvest}
            />
        </main>
    )
}
