import type { OrderSide, SimulateFixedIncomeResult } from '../../../services/market'

export interface OrderDraftBase {
    assetId: string
    ticker: string
    name: string
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
