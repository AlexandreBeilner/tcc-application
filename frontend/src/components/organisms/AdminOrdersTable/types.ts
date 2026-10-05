import type { AdminOrder } from '../../../services/admin'

export interface AdminOrdersTableProps {
    orders: AdminOrder[]
    // Id da ordem cuja mutação está em andamento, pra travar só o botão dela.
    cancellingId: string | null
    onCancel: (order: AdminOrder) => void
    emptyMessage: string
}
