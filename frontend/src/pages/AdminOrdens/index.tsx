import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Select } from '../../components/atoms/Select'
import type { SelectOption } from '../../components/atoms/Select'
import { ConfirmDialog } from '../../components/molecules/ConfirmDialog'
import { Pagination } from '../../components/molecules/Pagination'
import { AdminOrdersTable } from '../../components/organisms/AdminOrdersTable'
import { describeCancelError, describeOwner, isUuid } from '../../features/admin/adminOrders'
import { useCancelAdminOrderMutation, useCancelAdminOrdersBatchMutation } from '../../features/admin/useAdminOrderActions'
import { useAdminOrdersQuery } from '../../features/admin/useAdminOrdersQuery'
import type { AdminOrdersQueryFilters } from '../../features/admin/useAdminOrdersQuery'
import { useMarketMonitorQuery } from '../../features/admin/useMarketMonitorQuery'
import type { AdminOrder } from '../../services/admin'
import styles from './index.module.css'

const STATUS_OPTIONS: SelectOption[] = [
    { value: 'open', label: 'Abertas (pendentes e parciais)' },
    { value: '', label: 'Todos os status' },
    { value: 'pending', label: 'Pendentes' },
    { value: 'partially_filled', label: 'Parciais' },
    { value: 'filled', label: 'Executadas' },
    { value: 'cancelled', label: 'Canceladas' },
]

const SIDE_OPTIONS: SelectOption[] = [
    { value: '', label: 'Compra e venda' },
    { value: 'buy', label: 'Compra' },
    { value: 'sell', label: 'Venda' },
]

type Pending = { kind: 'single'; order: AdminOrder } | { kind: 'batch' } | null

// Tela 10.8 (N.10) — "Ordens" do painel, dentro da seção Mercado: busca de ordens por
// ativo, dono, lado e status, e cancelamento por intervenção (uma ordem ou todas as
// abertas do filtro de ativo/dono). Cancelar não mexe em saldo nem posição (nenhuma
// ordem em repouso reserva nada); a ação fica na auditoria.
export function AdminOrdens() {
    const [searchParams] = useSearchParams()
    const [status, setStatus] = useState('open')
    const [side, setSide] = useState('')
    const [assetId, setAssetId] = useState(searchParams.get('asset_id') ?? '')
    const [userId, setUserId] = useState(searchParams.get('user_id') ?? '')
    const [page, setPage] = useState(1)
    const [pending, setPending] = useState<Pending>(null)
    const [notice, setNotice] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const ownerInvalid = userId !== '' && !isUuid(userId)
    const filters = useMemo<AdminOrdersQueryFilters>(
        () => ({
            status: (status || undefined) as AdminOrdersQueryFilters['status'],
            side: (side || undefined) as AdminOrdersQueryFilters['side'],
            asset_id: assetId || undefined,
            user_id: userId && !ownerInvalid ? userId : undefined,
        }),
        [status, side, assetId, userId, ownerInvalid],
    )

    const ordersQuery = useAdminOrdersQuery(filters, page)
    const assetsQuery = useMarketMonitorQuery()
    const cancelOrder = useCancelAdminOrderMutation()
    const cancelBatch = useCancelAdminOrdersBatchMutation()

    const assetOptions: SelectOption[] = useMemo(
        () => [{ value: '', label: 'Todos os ativos' }, ...(assetsQuery.data ?? []).map((a) => ({ value: a.asset_id, label: a.ticker }))],
        [assetsQuery.data],
    )
    const selectedTicker = (assetsQuery.data ?? []).find((a) => a.asset_id === assetId)?.ticker

    function changeFilter(update: () => void) {
        update()
        setPage(1)
    }

    const canBatch = filters.asset_id !== undefined || filters.user_id !== undefined
    const batchScope = [
        selectedTicker ? `o ativo ${selectedTicker}` : filters.asset_id ? 'o ativo filtrado' : null,
        filters.user_id ? `o dono ${filters.user_id.slice(0, 8)}` : null,
    ]
        .filter(Boolean)
        .join(' e ')

    function confirmPending() {
        if (!pending) return
        setNotice(null)
        setError(null)
        if (pending.kind === 'single') {
            cancelOrder.mutate(pending.order.order_id, {
                onSuccess: () => setNotice(`Ordem de ${pending.order.ticker} cancelada.`),
                onError: (err) => setError(describeCancelError(err)),
                onSettled: () => setPending(null),
            })
            return
        }
        cancelBatch.mutate(
            { asset_id: filters.asset_id, user_id: filters.user_id },
            {
                onSuccess: (result) =>
                    setNotice(
                        result.cancelled_count === 0
                            ? 'Nenhuma ordem em repouso para cancelar nesse filtro.'
                            : `${result.cancelled_count} ordem(ns) cancelada(s).`,
                    ),
                onError: (err) => setError(describeCancelError(err)),
                onSettled: () => setPending(null),
            },
        )
    }

    const confirming = cancelOrder.isPending || cancelBatch.isPending

    return (
        <main className={styles.page}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>Ordens</h1>
                    <p className={styles.subtitle}>
                        Ordens do book de todos os usuários e bots. Cancelar tira a ordem do book, sem mexer em saldo nem posição.
                    </p>
                </div>
                <Link to="/admin/mercado" className={styles.link}>
                    Voltar ao monitor do mercado
                </Link>
            </header>

            <div className={styles.filters}>
                <label className={styles.field}>
                    <span>Status</span>
                    <Select
                        aria-label="Filtrar por status"
                        value={status}
                        options={STATUS_OPTIONS}
                        onChange={(v) => changeFilter(() => setStatus(v))}
                    />
                </label>
                <label className={styles.field}>
                    <span>Lado</span>
                    <Select
                        aria-label="Filtrar por lado"
                        value={side}
                        options={SIDE_OPTIONS}
                        onChange={(v) => changeFilter(() => setSide(v))}
                    />
                </label>
                <label className={styles.field}>
                    <span>Ativo</span>
                    <Select
                        aria-label="Filtrar por ativo"
                        value={assetId}
                        options={assetOptions}
                        onChange={(v) => changeFilter(() => setAssetId(v))}
                    />
                </label>
                <label className={styles.field}>
                    <span>Dono (id do usuário ou do bot)</span>
                    <input
                        className={styles.input}
                        value={userId}
                        placeholder="UUID, opcional"
                        aria-invalid={ownerInvalid}
                        onChange={(event) => changeFilter(() => setUserId(event.target.value.trim()))}
                    />
                </label>
            </div>
            {ownerInvalid && (
                <p className={styles.error} role="alert">
                    O id do dono precisa ser um UUID completo. O filtro foi ignorado.
                </p>
            )}

            <div className={styles.toolbar}>
                <button
                    type="button"
                    className={styles.batchButton}
                    disabled={!canBatch || confirming}
                    onClick={() => setPending({ kind: 'batch' })}
                >
                    Cancelar ordens abertas do filtro
                </button>
                {!canBatch && <span className={styles.hint}>Escolha um ativo ou um dono para habilitar o cancelamento em lote.</span>}
            </div>

            {notice && (
                <p className={styles.notice} role="status">
                    {notice}
                </p>
            )}
            {error && (
                <p className={styles.error} role="alert">
                    {error}
                </p>
            )}
            {ordersQuery.isError && (
                <p className={styles.error} role="alert">
                    Não foi possível carregar as ordens agora. Tente novamente em instantes.
                </p>
            )}
            {ordersQuery.isLoading && <p className={styles.loading}>Carregando ordens…</p>}

            {ordersQuery.data && (
                <>
                    <p className={styles.total}>{ordersQuery.data.total} ordem(ns)</p>
                    <AdminOrdersTable
                        orders={ordersQuery.data.orders}
                        cancellingId={cancelOrder.isPending ? (cancelOrder.variables ?? null) : null}
                        onCancel={(order) => setPending({ kind: 'single', order })}
                        emptyMessage="Nenhuma ordem com esse filtro."
                    />
                    <Pagination
                        page={ordersQuery.data.page}
                        totalPages={ordersQuery.data.totalPages}
                        onPageChange={setPage}
                        ariaLabel="Paginação das ordens"
                    />
                </>
            )}

            {pending?.kind === 'single' && (
                <ConfirmDialog
                    title="Cancelar esta ordem?"
                    confirmLabel="Cancelar ordem"
                    pendingLabel="Cancelando…"
                    pending={confirming}
                    onConfirm={confirmPending}
                    onCancel={() => setPending(null)}
                >
                    <p>
                        {pending.order.side === 'buy' ? 'Compra' : 'Venda'} de {pending.order.quantity - pending.order.filled_quantity}{' '}
                        {pending.order.ticker} a R$ {pending.order.price.toFixed(2).replace('.', ',')}, de {describeOwner(pending.order)}.
                    </p>
                    <p>O que já foi executado fica como está. A ação fica registrada na auditoria.</p>
                </ConfirmDialog>
            )}
            {pending?.kind === 'batch' && (
                <ConfirmDialog
                    title="Cancelar ordens em lote?"
                    confirmLabel="Cancelar em lote"
                    pendingLabel="Cancelando…"
                    pending={confirming}
                    requireText={selectedTicker ?? 'CANCELAR'}
                    onConfirm={confirmPending}
                    onCancel={() => setPending(null)}
                >
                    <p>
                        Cancela todas as ordens em repouso de {batchScope}, até 500 por lote. O status e o lado do filtro não restringem o
                        lote.
                    </p>
                    <p>Se o filtro atingir mais que o teto, nada é cancelado. A ação fica registrada na auditoria com a lista de ordens.</p>
                </ConfirmDialog>
            )}
        </main>
    )
}
