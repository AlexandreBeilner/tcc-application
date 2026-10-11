// Plano PRO de uma pessoa visto pelo painel e concessão promocional (MO.2.5). Quem implementa fala
// com o módulo `billing` (única fonte da verdade sobre plano), nunca com o banco direto.
export interface UserProStatus {
  isPro: boolean
  state: string
  plan: string | null
  store: string | null
  expiresAt: string | null
}

export interface UserProGrants {
  statusOf(userId: string): Promise<UserProStatus>
  // Fim do acesso PRO de agora (assinatura paga ou concessão anterior); `null` se não é PRO. Um
  // instante no ano 9999 ou depois significa acesso sem vencimento.
  currentAccessEnd(userId: string): Promise<Date | null>
  // Lança `ProGrantUnavailableError` (cobrança desligada) ou `ProGrantProviderError` (falha).
  grantUntil(userId: string, endsAt: Date): Promise<void>
}
