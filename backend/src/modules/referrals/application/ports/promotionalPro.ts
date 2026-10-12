// Visão do módulo `billing` que a indicação precisa. O adapter em `infrastructure/billing/`
// chama os casos de uso do dono do plano.
export interface PromotionalPro {
  // Fim do acesso PRO de agora; `null` se a pessoa não é PRO.
  currentAccessEnd(userId: string): Promise<Date | null>
  grantUntil(userId: string, endsAt: Date): Promise<void>
}
