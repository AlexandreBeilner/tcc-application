import { cashDirection, eventTotalValue } from '../../../features/market/cashFlow'
import { Delta } from '../../atoms/Delta'
import { formatCurrency } from '../../../features/portfolio/format'
import type { MarketEvent } from '../../../services/market'
import type { StatementListProps } from './types'
import styles from './index.module.css'

export type { StatementListProps } from './types'

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
})

// `market_events` (RF05, Event Sourcing — CLAUDE.md) é a fonte de verdade
// financeira: os 6 tipos de evento do enum (`event_type`, migration
// `000001`) cobrem ordem de compra/venda, aporte/resgate de renda fixa,
// depósito inicial e provento. Clique num item expande em accordion nativo
// (`<details>`), sem navegação nova (inventário 4.8).
export const EVENT_TYPE_LABELS: Record<string, string> = {
    initial_deposit: 'Depósito inicial',
    buy_order_executed: 'Compra executada',
    sell_order_executed: 'Venda executada',
    fixed_income_purchase: 'Aporte em renda fixa',
    fixed_income_redemption: 'Resgate de renda fixa',
    dividend_payment: 'Provento recebido',
    salary_payment: 'Salário',
    admin_credit: 'Crédito do administrador',
}

function eventLabel(event: MarketEvent): string {
    return EVENT_TYPE_LABELS[event.event_type] ?? event.event_type
}

// Colore o valor do extrato com sinal e seta (MO.9.4). Tipo sem direção de dinheiro aparece sem
// sinal, em vez de adivinhar.
function amountCell(event: MarketEvent, totalValue: number | undefined) {
    if (totalValue === undefined) return '—'
    const direction = cashDirection(event.event_type)
    if (direction === null) return formatCurrency(totalValue)
    return <Delta amount={direction === 'in' ? totalValue : -totalValue} kind="flow" variant="text" />
}

export function StatementList({ events, assetLabels = {} }: StatementListProps) {
    if (events.length === 0) {
        return <p className={styles.empty}>Você ainda não tem nenhuma transação registrada.</p>
    }

    return (
        <ul className={styles.list}>
            {events.map((event) => {
                const totalValue = eventTotalValue(event)
                return (
                    <li key={event.id}>
                        <details className={styles.item}>
                            <summary className={styles.summary}>
                                <span className={styles.type}>{eventLabel(event)}</span>
                                <span className={styles.date}>{dateFormatter.format(new Date(event.timestamp))}</span>
                                <span className={`${styles.amount} tabular-nums`}>{amountCell(event, totalValue)}</span>
                            </summary>
                            <div className={styles.details}>
                                {event.asset_id && (
                                    <div className={styles.detailRow}>
                                        <span>Ativo</span>
                                        <span>{assetLabels[event.asset_id] ?? event.asset_id}</span>
                                    </div>
                                )}
                                {event.quantity !== undefined && (
                                    <div className={styles.detailRow}>
                                        <span>Quantidade</span>
                                        <span className="tabular-nums">{event.quantity}</span>
                                    </div>
                                )}
                            </div>
                        </details>
                    </li>
                )
            })}
        </ul>
    )
}
