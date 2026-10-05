import { Link } from 'react-router-dom'
import { describeCancelReason, describeOwner, isCancellable, STATUS_LABELS } from '../../../features/admin/adminOrders'
import { formatDateTime } from '../../../features/admin/timeFormat'
import { formatCurrency } from '../../../features/portfolio/format'
import type { AdminOrder } from '../../../services/admin'
import type { AdminOrdersTableProps } from './types'
import styles from './index.module.css'

export type { AdminOrdersTableProps } from './types'

const integerFormatter = new Intl.NumberFormat('pt-BR')

function quantity(order: AdminOrder): string {
    return `${integerFormatter.format(order.filled_quantity)} / ${integerFormatter.format(order.quantity)}`
}

function side(order: AdminOrder): string {
    return `${order.side === 'buy' ? 'Compra' : 'Venda'} ${order.type === 'market' ? 'a mercado' : 'limitada'}`
}

function statusText(order: AdminOrder): string {
    const reason = describeCancelReason(order.cancel_reason)
    return reason ? `${STATUS_LABELS[order.status]}, ${reason}` : STATUS_LABELS[order.status]
}

// Ordens do book (N.10): tabela no tablet/desktop e cartões no mobile (nunca tabela com
// scroll horizontal em tela estreita). Estado nunca só por cor: o selo repete o texto
// (cancelada ganha borda tracejada, convenção sólido/tracejado do app). Só ordem em
// repouso mostra "Cancelar".
export function AdminOrdersTable({ orders, cancellingId, onCancel, emptyMessage }: AdminOrdersTableProps) {
    if (orders.length === 0) return <p className={styles.empty}>{emptyMessage}</p>

    const cancelButton = (order: AdminOrder) =>
        isCancellable(order) ? (
            <button
                type="button"
                className={styles.cancelButton}
                disabled={cancellingId === order.order_id}
                onClick={() => onCancel(order)}
            >
                Cancelar
            </button>
        ) : null

    const badge = (order: AdminOrder) => (
        <span className={`${styles.badge} ${order.status === 'cancelled' ? styles.dashed : ''}`}>{statusText(order)}</span>
    )

    return (
        <div className={styles.wrapper}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        {['Ativo', 'Ordem', 'Executado / total', 'Preço', 'Dono', 'Status', 'Criada em', ''].map((header) => (
                            <th key={header || 'acoes'} className={styles.th}>
                                {header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {orders.map((order) => (
                        <tr key={order.order_id} className={styles.tr}>
                            <td className={styles.td}>
                                <Link to={`/admin/mercado/ativos/${order.asset_id}`} className={styles.ticker}>
                                    {order.ticker}
                                </Link>
                            </td>
                            <td className={styles.td}>{side(order)}</td>
                            <td className={`${styles.td} tabular-nums`}>{quantity(order)}</td>
                            <td className={`${styles.td} tabular-nums`}>{formatCurrency(order.price)}</td>
                            <td className={styles.td}>{describeOwner(order)}</td>
                            <td className={styles.td}>{badge(order)}</td>
                            <td className={styles.td}>
                                {formatDateTime(order.created_at)}
                                <div className={styles.sub}>dia simulado {order.simulated_day}</div>
                            </td>
                            <td className={styles.td}>{cancelButton(order)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <ul className={styles.cards}>
                {orders.map((order) => (
                    <li key={order.order_id} className={styles.card}>
                        <div className={styles.cardHead}>
                            <Link to={`/admin/mercado/ativos/${order.asset_id}`} className={styles.ticker}>
                                {order.ticker}
                            </Link>
                            <span className={styles.sub}>{side(order)}</span>
                        </div>
                        <div className={styles.cardRow}>
                            <span className={styles.cardLabel}>Executado / total</span>
                            <span className="tabular-nums">{quantity(order)}</span>
                        </div>
                        <div className={styles.cardRow}>
                            <span className={styles.cardLabel}>Preço</span>
                            <span className="tabular-nums">{formatCurrency(order.price)}</span>
                        </div>
                        <div className={styles.cardRow}>
                            <span className={styles.cardLabel}>Dono</span>
                            <span>{describeOwner(order)}</span>
                        </div>
                        <div className={styles.cardRow}>
                            <span className={styles.cardLabel}>Status</span>
                            {badge(order)}
                        </div>
                        <div className={styles.cardRow}>
                            <span className={styles.cardLabel}>Criada em</span>
                            <span>{formatDateTime(order.created_at)}</span>
                        </div>
                        {cancelButton(order)}
                    </li>
                ))}
            </ul>
        </div>
    )
}
