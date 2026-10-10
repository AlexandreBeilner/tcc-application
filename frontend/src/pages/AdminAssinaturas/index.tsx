import { useState } from 'react'
import { StatCard, StatFact } from '../../components/molecules/StatCard'
import { formatCents, formatRate, SOURCE_LABELS } from '../../features/admin/conversionFormat'
import { useBillingConversionQuery } from '../../features/admin/useBillingConversionQuery'
import { formatDateTime } from '../../features/admin/timeFormat'
import type { BillingConversion, ConversionWindow, FunnelSteps } from '../../services/billing'
import styles from './index.module.css'

const WINDOWS: ConversionWindow[] = [7, 30, 90]

const FUNNEL_STEPS: Array<{ key: keyof FunnelSteps; label: string }> = [
    { key: 'lessonCompleted', label: 'Concluíram uma lição' },
    { key: 'inviteViewed', label: 'Viram um convite ao PRO' },
    { key: 'plansOpened', label: 'Abriram os planos' },
    { key: 'purchaseStarted', label: 'Iniciaram a compra' },
    { key: 'subscribed', label: 'Assinaram' },
    { key: 'cancelled', label: 'Cancelaram' },
]

function SubscribersCard({ data }: { data: BillingConversion }) {
    const { subscribers } = data
    return (
        <StatCard title="Assinantes ativos">
            <StatFact label="Total" value={String(subscribers.active)} />
            <StatFact label="Mensal" value={String(subscribers.monthly)} />
            <StatFact label="Anual" value={String(subscribers.annual)} />
            <StatFact label="Plano não identificado" value={String(subscribers.unknown)} />
        </StatCard>
    )
}

function RevenueCard({ data }: { data: BillingConversion }) {
    return (
        <StatCard title="Receita recorrente">
            <StatFact label="Estimada por mês" value={formatCents(data.recurringRevenueCents)} />
            <StatFact label="Cancelaram na janela" value={String(data.churn.cancelled)} />
            <StatFact label="Ativos no início da janela" value={String(data.churn.startOfWindow)} />
            <StatFact label="Churn da janela" value={formatRate(data.churn.rate)} />
        </StatCard>
    )
}

function FunnelBars({ funnel }: { funnel: FunnelSteps }) {
    const max = Math.max(...FUNNEL_STEPS.map((step) => funnel[step.key]), 1)
    return (
        <ul className={styles.funnel} aria-label="Funil de conversão">
            {FUNNEL_STEPS.map((step) => (
                <li key={step.key} className={styles.funnelRow}>
                    <span className={styles.funnelLabel}>{step.label}</span>
                    <span className={styles.funnelTrack} aria-hidden="true">
                        <span className={styles.funnelBar} style={{ width: `${(funnel[step.key] / max) * 100}%` }} />
                    </span>
                    <span className={styles.funnelCount}>{funnel[step.key]}</span>
                </li>
            ))}
        </ul>
    )
}

function SourceTable({ rows }: { rows: BillingConversion['bySource'] }) {
    return (
        <div className={styles.tableWrap}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th scope="col">Ponto de convite</th>
                        <th scope="col">Alcançados</th>
                        <th scope="col">Viram o convite</th>
                        <th scope="col">Abriram os planos</th>
                        <th scope="col">Iniciaram a compra</th>
                        <th scope="col">Assinaram</th>
                        <th scope="col">Conversão</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.source}>
                            <th scope="row">{SOURCE_LABELS[row.source]}</th>
                            <td>{row.reached}</td>
                            <td>{row.inviteViewed}</td>
                            <td>{row.plansOpened}</td>
                            <td>{row.purchaseStarted}</td>
                            <td>{row.subscribed}</td>
                            <td>{formatRate(row.conversionRate)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

// Painel de conversão do PRO (MO.7.1): assinantes ativos, mensal x anual, receita recorrente
// estimada, churn e funil por ponto de convite. Os eventos são próprios (sem terceiro) e contam
// pessoas distintas na janela escolhida.
export function AdminAssinaturas() {
    const [days, setDays] = useState<ConversionWindow>(30)
    const query = useBillingConversionQuery(days)
    const data = query.data

    return (
        <main className={styles.page}>
            <h1 className={styles.title}>Assinaturas</h1>
            <p className={styles.subtitle}>
                Quem assina, quanto isso rende e por onde as pessoas chegam ao PRO. Só cliente pagante: conta de teste das lojas e concessão
                promocional ficam de fora.
            </p>

            <div className={styles.windows} role="group" aria-label="Janela de análise">
                {WINDOWS.map((window) => (
                    <button
                        key={window}
                        type="button"
                        className={window === days ? styles.windowActive : styles.window}
                        aria-pressed={window === days}
                        onClick={() => setDays(window)}
                    >
                        {window} dias
                    </button>
                ))}
            </div>

            {data ? (
                <>
                    <div className={styles.grid}>
                        <SubscribersCard data={data} />
                        <RevenueCard data={data} />
                    </div>
                    {data.recurringRevenueCents === null && (
                        <p className={styles.note}>
                            A receita estimada precisa dos preços em centavos nas variáveis BILLING_PRICE_MONTHLY_CENTS e
                            BILLING_PRICE_ANNUAL_CENTS do backend.
                        </p>
                    )}

                    <section className={styles.section} aria-label="Funil">
                        <h2 className={styles.sectionTitle}>Funil dos últimos {data.windowDays} dias</h2>
                        <FunnelBars funnel={data.funnel} />
                    </section>

                    <section className={styles.section} aria-label="Por ponto de convite">
                        <h2 className={styles.sectionTitle}>Conversão por ponto de convite</h2>
                        <SourceTable rows={data.bySource} />
                        <p className={styles.note}>
                            Assinaram = teve contato com o ponto e assinou depois, na janela. Uma pessoa pode aparecer em mais de um ponto.
                            Churn é estimativa: parte dos ativos de hoje, descontando quem assinou e somando quem cancelou na janela.
                        </p>
                    </section>

                    <p className={styles.note}>Atualizado em {formatDateTime(data.generatedAt)}.</p>
                </>
            ) : query.isError ? (
                <p className={styles.error} role="alert">
                    Não foi possível carregar as métricas de assinatura.
                </p>
            ) : (
                <p className={styles.loading}>Carregando as métricas...</p>
            )}
        </main>
    )
}
