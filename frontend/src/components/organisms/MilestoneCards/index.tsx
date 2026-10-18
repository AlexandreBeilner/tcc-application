import {
    formatCohortWeek,
    formatDay,
    formatMilestoneTime,
    formatRetentionRate,
    MILESTONE_LABELS,
} from '../../../features/admin/retentionFormat'
import type { RetentionMilestone } from '../../../services/admin'
import type { MilestoneCardsProps } from './types'
import styles from './index.module.css'

export type { MilestoneCardsProps } from './types'

const ORDER: RetentionMilestone[] = ['first_return', 'first_lesson', 'first_trade', 'first_fixed_income', 'first_daily']

// Tempo até cada marco (RT.1.3): mediana entre o cadastro e a primeira vez, só de quem chegou, e
// quantos dos elegíveis já chegaram. Debaixo, a % de cada coorte em cada marco.
export function MilestoneCards({ data }: MilestoneCardsProps) {
    if (data.eligible === 0) {
        return (
            <p className={styles.empty}>
                Ainda sem dado de marcos.{' '}
                {data.tracking_since
                    ? `Só entram pessoas cadastradas a partir de ${formatDay(data.tracking_since)}, quando o registro começou.`
                    : 'O registro começa na primeira visita depois da publicação.'}
            </p>
        )
    }
    const byKey = new Map(data.milestones.map((m) => [m.milestone, m]))
    return (
        <div className={styles.wrap}>
            <ul className={styles.cards} aria-label="Tempo até cada marco">
                {ORDER.map((key) => {
                    const item = byKey.get(key)
                    if (!item) return null
                    return (
                        <li key={key} className={styles.card}>
                            <span className={styles.label}>{MILESTONE_LABELS[key]}</span>
                            <span className={styles.time}>{formatMilestoneTime(item)}</span>
                            <span className={styles.caption}>
                                tempo mediano até chegar · {formatRetentionRate(item.reached_rate)} chegaram ({item.reached} de{' '}
                                {data.eligible})
                            </span>
                        </li>
                    )
                })}
            </ul>
            <p className={styles.note}>
                Só entram pessoas cadastradas a partir de{' '}
                {data.tracking_since ? formatDay(data.tracking_since) : 'quando o registro começou'}. A primeira operação conta ação, FII,
                ETF e renda fixa do mercado ao vivo, nunca as operações de treino.
            </p>

            <details className={styles.details}>
                <summary className={styles.summary}>Marcos por coorte</summary>
                <div className={styles.scroll} tabIndex={0} role="region" aria-label="Marcos por coorte">
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th scope="col" className={styles.weekHead}>
                                    Semana de cadastro
                                </th>
                                <th scope="col">Pessoas</th>
                                {ORDER.map((key) => (
                                    <th key={key} scope="col">
                                        {MILESTONE_LABELS[key]}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.cohorts.map((cohort) => (
                                <tr key={cohort.cohort_week}>
                                    <th scope="row" className={styles.weekHead}>
                                        {formatCohortWeek(cohort.cohort_week)}
                                    </th>
                                    <td>{cohort.size}</td>
                                    {ORDER.map((key) => (
                                        <td
                                            key={key}
                                            className={cohort.status === 'in_progress' ? styles.growing : undefined}
                                            title={
                                                cohort.status === 'in_progress'
                                                    ? 'Coorte recente: a porcentagem ainda está subindo'
                                                    : undefined
                                            }
                                        >
                                            {formatRetentionRate(cohort.rates[key])}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p className={styles.note}>
                    Tracejado: coorte com menos de 30 dias depois do fim da semana, a porcentagem ainda está subindo.
                </p>
            </details>
        </div>
    )
}
