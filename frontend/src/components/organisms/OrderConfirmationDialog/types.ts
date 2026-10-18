import type { OrderSide, SimulateFixedIncomeResult } from '../../../services/market'

export interface OrderDraftBase {
    assetId: string
    ticker: string
    name: string
    // Ativo do Modo Aprendizado: não mexe no caixa (ponto 063), então o resumo não mostra o saldo após a ordem.
    isSandbox?: boolean
}

export interface OrderDraftOrder extends OrderDraftBase {
    kind: 'order'
    side: OrderSide
    quantity: number
    unitPrice: number
}

export interface OrderDraftFixedIncomePurchase extends OrderDraftBase {
    kind: 'fixed_income_purchase'
    amount: number
    projected?: SimulateFixedIncomeResult
}

export interface OrderDraftFixedIncomeRedemption extends OrderDraftBase {
    kind: 'fixed_income_redemption'
}

export type OrderDraft = OrderDraftOrder | OrderDraftFixedIncomePurchase | OrderDraftFixedIncomeRedemption

export interface OrderConfirmationDialogProps {
    draft: OrderDraft
    onClose: () => void
}
