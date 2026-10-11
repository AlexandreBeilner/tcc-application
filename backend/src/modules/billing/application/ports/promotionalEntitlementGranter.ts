// Concede o entitlement PRO promocional até uma data (MO.2.5 e MO.7.2). Contrato: ao voltar, a
// projeção local já enxerga a concessão (`GET /billing/status`). Repetir a chamada com o MESMO
// `endsAt` não concede duas vezes (o RevenueCat trata fim a menos de 2 h do anterior como
// duplicata). Lança `BillingDisabledError` com a cobrança desligada e `BillingProviderError` em
// falha do provedor.
export interface PromotionalEntitlementGranter {
  grantUntil(userId: string, endsAt: Date): Promise<void>
}
