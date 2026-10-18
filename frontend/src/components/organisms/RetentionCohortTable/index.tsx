import {
    formatCohortWeek,
    formatRetentionRate,
    RETENTION_BANDS,
    retentionBand,
    retentionCellText,
    type RetentionDayKey,
} from '../../../features/admin/retentionFormat'
import type { RetentionCell } from '../../../services/admin'
import type { RetentionCohortTableProps } from './types'
import styles from './index.module.css'

export type { RetentionCohortTableProps } from './types'

const DAYS: Array<{ key: RetentionDayKey; label: string }> = [
    { key: 'd1', label: 'Dia 1' },
    { key: 'd7', label: 'Dia 7' },
    { key: 'd30', label: 'Dia 30' },
]

function Cell({ day, cell }: { day: RetentionDayKey; cell: RetentionCell }) {
    // Sem taxa (em andamento ou sem dado) a célula fica tracejada e apagada: ainda não aconteceu ou
    // não foi registrado, e nunca pode ser lida como 0%. Com taxa, a cor é a faixa da coluna.
    const className =
        cell.rate === null
            ? styles.pending
            : `${styles.value} ${styles[retentionBand(day, cell.rate)]}${cell.status === 'partial' ? ` ${styles.partial}` : ''}`
    const title =
        cell.status === 'partial'
            ? `Parcial: medido em ${cell.measured} de ${cell.size} pessoas, o resto ainda não pôde ser medido`
            : cell.status === 'in_progress'
              ? 'O dia ainda não chegou para esta coorte'
              : cell.status === 'no_data'
                ? 'Anterior ao início do registro desta medida'
                : undefined
    return (
        <td className={className} title={title}>
            {retentionCellText(cell)}
            {cell.status === 'partial' && <span aria-label="parcial">*</span>}
        </td>
    )
}

// Tabela de coortes semanais do painel de retenção (RT.1.3): uma linha por semana de cadastro, a % que
// voltou e a % que estudou exatamente no dia 1, 7 e 30 depois do cadastro. Cor por faixa em cada coluna.
export function RetentionCohortTable({ cohorts }: RetentionCohortTableProps) {
    if (cohorts.length === 0) {
        return <p className={styles.empty}>Ninguém se cadastrou nas semanas escolhidas.</p>
    }
    return (
        <div className={styles.wrap}>
            <div className={styles.scroll} tabIndex={0} role="region" aria-label="Tabela de coortes semanais">
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th scope="col" rowSpan={2} className={styles.weekHead}>
                                Semana de cadastro
                            </th>
                            <th scope="col" rowSpan={2}>
                                Pessoas
                            </th>
                            <th scope="colgroup" colSpan={3} className={styles.group}>
                                Voltou
                            </th>
                            <th scope="colgroup" colSpan={3} className={styles.group}>
                                Estudou
                            </th>
                        </tr>
                        <tr>
                            {DAYS.map((d) => (
                                <th key={`r-${d.key}`} scope="col">
                                    {d.label}
                                </th>
                            ))}
                            {DAYS.map((d) => (
                                <th key={`s-${d.key}`} scope="col">
                                    {d.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {cohorts.map((cohort) => (
                            <tr key={cohort.cohort_week}>
                                <th scope="row" className={styles.weekHead}>
                                    {formatCohortWeek(cohort.cohort_week)}
                                </th>
                                <td>{cohort.size}</td>
                                {DAYS.map((d) => (
                                    <Cell key={`r-${d.key}`} day={d.key} cell={cohort.returned[d.key]} />
                                ))}
                                {DAYS.map((d) => (
                                    <Cell key={`s-${d.key}`} day={d.key} cell={cohort.studied[d.key]} />
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <ul className={styles.legend} aria-label="Legenda das faixas">
                {DAYS.map((d) => (
                    <li key={d.key}>
                        <strong>{d.label}:</strong> <span className={styles.goodText}>verde</span> a partir de{' '}
                        {formatRetentionRate(RETENTION_BANDS[d.key].good)}, <span className={styles.lowText}>vermelho</span> abaixo de{' '}
                        {formatRetentionRate(RETENTION_BANDS[d.key].low)}
                    </li>
                ))}
                <li>
                    <span className={styles.pendingSample}>tracejado</span> = em andamento (o dia ainda não chegou) ou sem dado (antes do
                    registro). Nunca é 0%.
                </li>
                <li>* parcial: só parte da coorte já pôde ser medida; a taxa vale para quem foi medido.</li>
            </ul>
        </div>
    )
}
