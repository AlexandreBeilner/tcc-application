import { useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from '../../atoms/Button'
import { useCancelOrderMutation } from '../../../features/market/useCancelOrderMutation'
import { formatCurrency } from '../../../features/portfolio/format'
import type { MyOrderRecord, OrderCancelReason } from '../../../services/market'
import type { OrdersListProps, OrdersListTab } from './types'
import styles from './index.module.css'

export type { OrdersListProps, OrdersListTab } from './types'

const TABS: { key: OrdersListTab; label: string }[] = [
    { key: 'pending', label: 'Pendentes' },
    { key: 'filled', label: 'Executadas' },
    { key: 'cancelled', label: 'Recusadas' },
]

const EMPTY_MESSAGE: Record<OrdersListTab, string> = {
    pending: 'Você não tem nenhuma ordem pendente no momento.',
    filled: 'Nenhuma ordem executada ainda.',
    cancelled: 'Nenhuma ordem recusada ou cancelada ainda.',
}

const SIDE_LABEL = { buy: 'Compra', sell: 'Venda' } as const
const TYPE_LABEL = { market: 'Mercado', limit: 'Limitada' } as const

// `requoted` (Market Maker recotando a própria oferta, achado 005 parte
// A.4) nunca deveria alcançar um usuário real (`.docs/engine/orders.md`) —
// rótulo mantido só pra nunca deixar a coluna em branco se isso acontecer.
const CANCEL_REASON_LABEL: Record<OrderCancelReason, string> = {
    user_cancelled: 'Cancelada por você',
    expired: 'Expirada no fechamento do dia',
    no_liquidity: 'Sem liquidez disponível',
    requoted: 'Recotada pelo motor',
    insufficient_funds: 'Cancelada: saldo ou posição insuficiente no momento da execução',
}

// Agrupamento decidido na sessão O.3 (2026-09-21): Pendentes = pending +
// partially_filled; Executadas = filled; Recusadas = cancelled (qualquer
// cancel_reason, motivo humanizado por linha, não sub-abas).
function matchesTab(order: MyOrderRecord, tab: OrdersListTab): boolean {
    if (tab === 'pending') return order.status === 'pending' || order.status === 'partially_filled'
    return order.status === tab
}

// Checa `filled_quantity` em vez de `status === 'partially_filled'` (achado
// desta sessão de teste ponta a ponta): uma ordem parcialmente preenchida e
// depois cancelada (O.1) vira `status = cancelled`, então checar só o status
// escondia da aba Recusadas que parte da ordem já tinha sido executada de
// verdade (saldo/posição já debitados/creditados) antes do cancelamento —
// o usuário via só a quantidade total, sem nenhum sinal do que realmente
// aconteceu com o próprio dinheiro.
function formatQuantity(order: MyOrderRecord): string {
    if (order.filled_quantity > 0 && order.filled_quantity < order.quantity) {
        return `${order.filled_quantity}/${order.quantity}`
    }
    return String(order.quantity)
}

interface Column {
    key: string
    header: string
    render: (order: MyOrderRecord) => ReactNode
}

interface CancelActionController {
    confirmingOrderId: string | null
    onRequestCancel: (orderId: string | null) => void
    onConfirmCancel: (orderId: string) => void
    isCancelling: (orderId: string) => boolean
}

// Ação "Cancelar ordem" (O.1) segue a mesma confirmação leve em duas
// etapas já usada por `FriendsList` ("Desfazer amizade") — sem
// `window.confirm` nativo, sem precedente no app.
function CancelOrderAction({ order, controller }: { order: MyOrderRecord; controller: CancelActionController }) {
    const isConfirming = controller.confirmingOrderId === order.order_id
    const isCancelling = controller.isCancelling(order.order_id)

    if (!isConfirming) {
        return (
            <Button variant="secondary" onClick={() => controller.onRequestCancel(order.order_id)}>
                Cancelar ordem
            </Button>
        )
    }

    return (
        <div className={styles.confirmActions}>
            <Button variant="secondary" disabled={isCancelling} onClick={() => controller.onRequestCancel(null)}>
                Voltar
            </Button>
            <Button disabled={isCancelling} onClick={() => controller.onConfirmCancel(order.order_id)}>
                Confirmar cancelamento
            </Button>
        </div>
    )
}

function buildColumns(tab: OrdersListTab, controller: CancelActionController): Column[] {
    const columns: Column[] = [
        { key: 'asset', header: 'Ativo', render: (order) => `${order.ticker} · ${order.name}` },
        { key: 'side', header: 'Lado', render: (order) => SIDE_LABEL[order.side] },
        { key: 'type', header: 'Tipo', render: (order) => TYPE_LABEL[order.type] },
        { key: 'quantity', header: 'Quantidade', render: formatQuantity },
        { key: 'price', header: 'Preço', render: (order) => formatCurrency(order.price) },
    ]

    if (tab === 'cancelled') {
        columns.push({
            key: 'reason',
            header: 'Motivo',
            render: (order) => (order.cancel_reason ? CANCEL_REASON_LABEL[order.cancel_reason] : '—'),
        })
    }

    if (tab === 'pending') {
        columns.push({
            key: 'actions',
            header: '',
            render: (order) => <CancelOrderAction order={order} controller={controller} />,
        })
    }

    return columns
}

// Tela "Minhas Ordens" (tarefa O.4) — mesma tela-tipo "lista com abas" já
// estabelecida por `pages/EquityList`/`pages/FixedIncomeList`
// (identidade-visual-padroes.md), com a mesma dupla tabela/cards
// responsiva de `AssetTable` (tabela ≥1024px, cards empilhados abaixo) —
// não reaproveita `AssetTable` porque a linha aqui nunca navega (sem
// `onSelect`) e a aba Pendentes precisa de um botão de ação por linha, que
// o card-como-`<button>` de `AssetTable` não comporta (elemento
// interativo aninhado).
export function OrdersList({ orders }: OrdersListProps) {
    const [activeTab, setActiveTab] = useState<OrdersListTab>('pending')
    const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null)
    const cancelOrder = useCancelOrderMutation()

    function handleTabChange(tab: OrdersListTab) {
        setActiveTab(tab)
        setConfirmingOrderId(null)
    }

    const controller: CancelActionController = {
        confirmingOrderId,
        onRequestCancel: setConfirmingOrderId,
        onConfirmCancel: (orderId) => {
            cancelOrder.mutate(orderId)
            setConfirmingOrderId(null)
        },
        isCancelling: (orderId) => cancelOrder.isPending && cancelOrder.variables === orderId,
    }

    const visibleOrders = orders.filter((order) => matchesTab(order, activeTab))
    const columns = buildColumns(activeTab, controller)

    return (
        <div className={styles.wrapper}>
            <div className={styles.tabs} role="tablist" aria-label="Status da ordem">
                {TABS.map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        role="tab"
                        aria-selected={tab.key === activeTab}
                        className={[styles.tab, tab.key === activeTab && styles.tabActive].filter(Boolean).join(' ')}
                        onClick={() => handleTabChange(tab.key)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {cancelOrder.isError && (
                <p className={styles.error} role="alert">
                    Não foi possível cancelar a ordem agora. Tente novamente em instantes.
                </p>
            )}

            {visibleOrders.length === 0 ? (
                <p className={styles.empty}>{EMPTY_MESSAGE[activeTab]}</p>
            ) : (
                <div className={styles.listWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                {columns.map((column) => (
                                    <th key={column.key} className={styles.th}>
                                        {column.header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {visibleOrders.map((order) => (
                                <tr key={order.order_id} className={styles.tr}>
                                    {columns.map((column) => (
                                        <td key={column.key} className={styles.td}>
                                            {column.render(order)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className={styles.cards}>
                        {visibleOrders.map((order) => (
                            <div key={order.order_id} className={styles.card}>
                                {columns.map((column) => (
                                    <div key={column.key} className={styles.cardRow}>
                                        {column.header && <span className={styles.cardLabel}>{column.header}</span>}
                                        <span className={styles.cardValue}>{column.render(order)}</span>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
