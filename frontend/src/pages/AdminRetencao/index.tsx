import { useState } from 'react'
import { MilestoneCards } from '../../components/organisms/MilestoneCards'
import { RetentionCohortTable } from '../../components/organisms/RetentionCohortTable'
import { RetentionLineChart } from '../../components/organisms/RetentionLineChart'
import { StatCard, StatFact } from '../../components/molecules/StatCard'
import { formatDay, formatRetentionRate } from '../../features/admin/retentionFormat'
import { useAdminRetentionQuery } from '../../features/admin/useAdminRetentionQuery'
import type { AdminRetention } from '../../services/admin'
import styles from './index.module.css'

const WEEK_OPTIONS = [8, 12, 26, 52]
const DAY_OPTIONS = [30, 60, 90, 180]

const countFormatter = new Intl.NumberFormat('pt-BR')
const formatCount = (value: number | null) => (value === null ? 'sem dado' : countFormatter.format(value))

function Choice({
    label,
    options,
    value,
    unit,
    onChange,
}: {
    label: string
    options: number[]
    value: number
    unit: string
    onChange: (v: number) => void
}) {
    return (
        <div className={styles.choice} role="group" aria-label={label}>
            <span className={styles.choiceLabel}>{label}</span>
            {options.map((option) => (
                <button
                    key={option}
                    type="button"
                    className={option === value ? styles.pillActive : styles.pill}
                    aria-pressed={option === value}
                    onClick={() => onChange(option)}
                >
                    {option} {unit}
                </button>
            ))}
        </div>
    )
}

function YesterdayCard({ active }: { active: AdminRetention['active'] }) {
    const last = active.days.at(-1)
    if (!last) return <StatCard title="Ontem" unavailable="sem dias no período" />
    return (
        <StatCard title={`Ontem (${formatDay(last.day)})`}>
            <StatFact label="Voltaram (DAU)" value={formatCount(last.returned)} />
            <StatFact label="Estudaram" value={formatCount(last.studied)} />
            <StatFact label="Ativos em 30 dias (MAU)" value={formatCount(last.mau)} />
            <StatFact label="DAU/MAU" value={last.dau_mau === null ? 'sem dado' : formatRetentionRate(last.dau_mau)} />
        </StatCard>
    )
}

function ActiveCharts({ active }: { active: AdminRetention['active'] }) {
    const days = active.days.map((d) => d.day)
    const last = active.days.at(-1)
    const range = days.length > 0 ? `de ${formatDay(days[0])} a ${formatDay(days[days.length - 1])}` : ''
    const since = active.tracking_since.presence
    const mauStart = since
        ? `A razão só aparece quando os 30 dias da janela estão dentro do registro (a partir de ${formatDay(new Date(Date.parse(`${since}T00:00:00Z`) + 29 * 86_400_000).toISOString().slice(0, 10))}).`
        : undefined
    const presenceNote = since
        ? `Dias antes de ${formatDay(since)} ficam em branco: o registro de presença começou nesse dia.`
        : 'Ainda sem registro de presença: ele começa na primeira visita depois da publicação.'

    return (
        <>
            <RetentionLineChart
                title="Ativos por dia"
                days={days}
                series={[
                    {
                        key: 'returned',
                        label: 'Voltaram',
                        color: 'var(--color-brand-500)',
                        values: active.days.map((d) => d.returned),
                        filled: true,
                    },
                    { key: 'studied', label: 'Estudaram', color: 'var(--color-gamify-500)', values: active.days.map((d) => d.studied) },
                ]}
                formatValue={(value) => countFormatter.format(Math.round(value))}
                summary={`Ativos por dia ${range}. Último dia: ${formatCount(last?.returned ?? null)} voltaram e ${formatCount(last?.studied ?? null)} estudaram.`}
                emptyMessage="Ainda não há dias suficientes registrados para desenhar o gráfico."
                note={presenceNote}
            />
            <RetentionLineChart
                title="DAU/MAU"
                days={days}
                series={[
                    {
                        key: 'dau_mau',
                        label: 'Fração do mês que aparece num dia',
                        color: 'var(--color-brand-300)',
                        values: active.days.map((d) => d.dau_mau),
                        filled: true,
                    },
                ]}
                formatValue={(value) => formatRetentionRate(value)}
                summary={`Razão entre ativos do dia e ativos em 30 dias ${range}. Último dia: ${last?.dau_mau == null ? 'sem dado' : formatRetentionRate(last.dau_mau)}.`}
                emptyMessage="A razão DAU/MAU precisa de 30 dias de registro de presença. Ainda não há dado."
                note={mauStart}
            />
        </>
    )
}

// Tela 10.18 (RT.1.3): painel de retenção. Coortes semanais (voltou e estudou nos dias 1, 7 e 30),
// ativos por dia com DAU/MAU e tempo até cada marco. Só números agregados, nenhuma pessoa (RP4).
export function AdminRetencao() {
    const [weeks, setWeeks] = useState(12)
    const [days, setDays] = useState(60)
    const query = useAdminRetentionQuery({ weeks, days })
    const data = query.data

    return (
        <main className={styles.page}>
            <h1 className={styles.title}>Retenção</h1>
            <p className={styles.subtitle}>
                Quem volta e quem estuda depois do cadastro. "Voltou" é qualquer acesso no dia; "estudou" é lição ou missão concluída. Os
                dados começam a contar na publicação do registro, então coortes antigas aparecem como sem dado.
            </p>

            <div className={styles.filters}>
                <Choice label="Coortes" options={WEEK_OPTIONS} value={weeks} unit="semanas" onChange={setWeeks} />
                <Choice label="Gráfico" options={DAY_OPTIONS} value={days} unit="dias" onChange={setDays} />
            </div>

            {data ? (
                <>
                    <YesterdayCard active={data.active} />

                    <section className={styles.section} aria-label="Coortes semanais">
                        <h2 className={styles.sectionTitle}>Coortes por semana de cadastro</h2>
                        <RetentionCohortTable cohorts={data.cohorts.cohorts} />
                    </section>

                    <div className={styles.split}>
                        <section className={styles.charts} aria-label="Ativos por dia">
                            <ActiveCharts active={data.active} />
                        </section>
                        <section className={styles.side} aria-label="Marcos">
                            <h2 className={styles.sectionTitle}>Tempo até cada marco</h2>
                            <MilestoneCards data={data.milestones} />
                        </section>
                    </div>
                </>
            ) : query.isError ? (
                <p className={styles.error} role="alert">
                    Não foi possível carregar o painel de retenção.
                </p>
            ) : (
                <p className={styles.loading}>Carregando os números...</p>
            )}
        </main>
    )
}
