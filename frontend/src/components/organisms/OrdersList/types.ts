import type { MyOrderRecord } from '../../../services/market'

export type OrdersListTab = 'pending' | 'filled' | 'cancelled'

export interface OrdersListProps {
    orders: MyOrderRecord[]
}
