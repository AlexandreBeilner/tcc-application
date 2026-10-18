import { sumMetrics } from '../../../features/admin/dailyAdmin'
import { useDailyMetricsQuery } from '../../../features/admin/useAdminDaily'
import styles from './index.module.css'

// Dias mostrados na tabela; a soma do cabeçalho cobre os mesmos.
const DAYS = 30

type Totals = ReturnType<typeof sumMetrics>

function formatDay(date: string): string {
    const [, month, day] = date.split('-')
    return `${day}/${month}`
}

const COLUMNS: { key: keyof Totals; label: string }[] = [
    { key: 'anon_started', label: 'Sem conta: iniciados' },
    { key: 'anon_completed', label: 'Sem conta: concluídos' },
    { key: 'logged_started', label: 'Com conta: iniciados' },
    { key: 'logged_completed', label: 'Com conta: concluídos' },
    { key: 'signups', label: 'Cadastros do Diário' },
    { key: 'logins', label: 'Logins do Diário' },
]

// Medição do Diário (DI.7.1): jogos por dia (quem joga na página pública da landing e quem joga
// logado) e cadastros e logins que chegaram com `?origem=diario`. Os números de quem tem conta
// batem com `daily_results`; os da landing são avisos do navegador, sem identificador, então são
// uma estimativa (quem limpa os dados do navegador pode contar de novo). Tabela do tablet em
// diante, cartões por dia no mobile.
export function AdminDailyMetrics() {
    const query = useDailyMetricsQuery(DAYS)
    const days = query.data
    const totals = days ? sumMetrics(days) : null

    return (
        <section className={styles.root} aria-labelledby="daily-metrics-title">
            <h2 id="daily-metrics-title" className={styles.title}>
                Medição
            </h2>
            <p className={styles.muted}>
                Últimos {DAYS} dias (dia UTC, que vira às 21h de Brasília). Sem conta é contagem aproximada, avisada pela página da landing.
            </p>

            {query.isLoading && <p className={styles.muted}>Carregando a medição…</p>}
            {query.isError && (
                <p className={styles.error} role="alert">
                    Não foi possível carregar a medição agora.
                </p>
            )}

            {days && totals && (
                <>
                    <dl className={styles.totals} aria-label="Totais do período">
                        {COLUMNS.map((c) => (
                            <div key={c.key} className={styles.total}>
                                <dt className={styles.totalLabel}>{c.label}</dt>
                                <dd className={styles.totalValue}>{totals[c.key]}</dd>
                            </div>
                        ))}
                    </dl>

                    <table className={styles.table}>
                        <caption className={styles.srOnly}>Medição do Diário por dia</caption>
                        <thead>
                            <tr>
                                <th className={styles.th} scope="col">
                                    Dia
                                </th>
                                {COLUMNS.map((c) => (
                                    <th key={c.key} className={styles.th} scope="col">
                                        {c.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {days.map((d) => (
                                <tr key={d.date} className={styles.tr}>
                                    <th className={styles.td} scope="row">
                                        {formatDay(d.date)}
                                    </th>
                                    {COLUMNS.map((c) => (
                                        <td key={c.key} className={d[c.key] === 0 ? `${styles.td} ${styles.zero}` : styles.td}>
                                            {d[c.key]}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <ul className={styles.cards}>
                        {days.map((d) => (
                            <li key={d.date} className={styles.card}>
                                <strong className={styles.cardDay}>{formatDay(d.date)}</strong>
                                <dl className={styles.cardList}>
                                    {COLUMNS.map((c) => (
                                        <div key={c.key} className={styles.cardRow}>
                                            <dt>{c.label}</dt>
                                            <dd>{d[c.key]}</dd>
                                        </div>
                                    ))}
                                </dl>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </section>
    )
}
