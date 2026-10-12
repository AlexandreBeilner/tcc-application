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

// Porta de compra. Na web a implementação fala com o SDK web do RevenueCat (M12); dentro do app,
// com a compra nativa pela ponte (MO.4.2). A tela e os testes só enxergam isto.
export interface WebPurchases {
    loadPlans(): Promise<WebPlan[]>
    purchase(plan: WebPlan): Promise<PurchaseOutcome>
    // Só dentro do app (as lojas exigem "Restaurar compras"): `hasPro` = a loja devolveu um direito
    // ativo; quem confirma o PRO continua sendo o servidor.
    restore?(): Promise<{ hasPro: boolean }>
    // Só dentro do app: abre o gerenciamento da loja pelo sistema (nunca um link de pagamento web).
    manage?(url: string | null): Promise<void>
}
