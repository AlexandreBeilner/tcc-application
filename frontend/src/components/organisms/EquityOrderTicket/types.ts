import type { OrderSide } from '../../../services/market'

export interface EquityOrderTicketProps {
    unitPrice?: number
    // Motivo em texto de a ordem estar bloqueada agora (mercado fechado, tarefa S.11); desabilita o botão.
    closedReason?: string | null
    onSubmit: (side: OrderSide, quantity: number) => void
}
