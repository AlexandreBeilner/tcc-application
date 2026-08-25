// Port própria e mínima sobre `modules/gamification` (5.1) — mesmo padrão
// de `lessons/application/ports/xpAwarder.ts` (adapter em processo sobre
// `AwardXpUseCase`, decisão de composição em `app.ts`).
export interface XpAwarder {
  award(userId: string, amount: number, reason: string): Promise<void>
}
