// Um plano ofertado, já com o preço do Offering do RevenueCat (nunca hardcoded). `handle` é o
// pacote opaco do SDK, devolvido ao `purchase`.
export interface WebPlan {
    id: 'monthly' | 'annual'
    formattedPrice: string
    amountMicros: number
    currency: string
    handle: unknown
}

export type PurchaseOutcome = 'purchased' | 'cancelled'

// Porta da compra web (M12). A implementação real fala com o SDK do RevenueCat; a tela e os
// testes só enxergam isto.
export interface WebPurchases {
    loadPlans(): Promise<WebPlan[]>
    purchase(plan: WebPlan): Promise<PurchaseOutcome>
}
