import { formatCurrency } from '../../../features/portfolio/format'
import type { DividendHistoryListProps } from './types'
import styles from './index.module.css'

export type { DividendHistoryListProps } from './types'

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

// Histórico de proventos (`dividend_events`) — mesma fonte e mesmo cálculo
// pra ação e FII (`.docs/engine/catalog.md`, tarefa 4.9: "dividend.Yield...
// calculado independentemente pras duas classes"), por isso é o único
// bloco de `GET /assets/:id` genuinamente compartilhado entre as duas
// especializações (CLAUDE.md só proíbe reaproveitar o layout de
// *indicadores*, não este).
export function DividendHistoryList({ history }: DividendHistoryListProps) {
    if (history.length === 0) {
        return <p className={styles.empty}>Este ativo ainda não pagou nenhum provento.</p>
    }

    return (
        <ul className={styles.list}>
            {history.map((entry) => (
                <li key={`${entry.ex_date}-${entry.payment_date}`} className={styles.item}>
                    <span className={styles.date}>Pago em {dateFormatter.format(new Date(entry.payment_date))}</span>
                    <span className={`${styles.value} tabular-nums`}>{formatCurrency(entry.value_per_share)} / cota</span>
                </li>
            ))}
        </ul>
    )
}
