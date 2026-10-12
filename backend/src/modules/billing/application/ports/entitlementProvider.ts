import type { EntitlementState } from '../../domain/subscription'

// Fonte da verdade do plano: o provedor de assinaturas (RevenueCat), que unifica web, App Store e
// Play Store. O backend só pergunta "qual o estado do entitlement PRO deste usuário agora?".
export interface EntitlementProvider {
  // `null` = o usuário não tem (nem teve) o entitlement PRO. Lança `BillingProviderError` em falha
  // de rede/5xx, e `BillingDisabledError` quando a cobrança está desligada.
  getEntitlement(userId: string): Promise<EntitlementState | null>
}
