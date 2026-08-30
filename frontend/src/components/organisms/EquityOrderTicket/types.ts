import type { OrderSide } from '../../../services/market'

export interface EquityOrderTicketProps {
    unitPrice?: number
    onSubmit: (side: OrderSide, quantity: number) => void
}
