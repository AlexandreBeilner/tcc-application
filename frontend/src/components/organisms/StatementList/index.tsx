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
}

function eventLabel(event: MarketEvent): string {
    return EVENT_TYPE_LABELS[event.event_type] ?? event.event_type
}

// `unit_value` é preço por unidade para buy/sell_order_executed e
// dividend_payment (que sempre trazem `quantity` junto) — nesses casos o
// valor total transacionado é unit_value × quantity. Para initial_deposit e
// os eventos de renda fixa, `quantity` nunca é gravado (engine,
// fixed_income_execution_repository.go) e unit_value já é o total.
function eventTotalValue(event: MarketEvent): number | undefined {
    if (event.unit_value === undefined) {
        return undefined
    }
    return event.quantity !== undefined ? event.unit_value * event.quantity : event.unit_value
}

// Dinheiro que entra na conta e dinheiro que sai (MO.9.4): colore o valor do extrato com sinal e seta.
// Tipo fora das duas listas aparece sem sinal, em vez de adivinhar a direção.
const INFLOW_TYPES = new Set(['initial_deposit', 'sell_order_executed', 'fixed_income_redemption', 'dividend_payment'])
const OUTFLOW_TYPES = new Set(['buy_order_executed', 'fixed_income_purchase'])

function amountCell(event: MarketEvent, totalValue: number | undefined) {
    if (totalValue === undefined) return '—'
    if (INFLOW_TYPES.has(event.event_type)) return <Delta amount={totalValue} kind="flow" variant="text" />
    if (OUTFLOW_TYPES.has(event.event_type)) return <Delta amount={-totalValue} kind="flow" variant="text" />
    return formatCurrency(totalValue)
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
