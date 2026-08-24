// Port própria e mínima sobre o crédito de xp de `modules/gamification`
// (5.1) — implementada, na composição (app.ts), por um adapter em processo
// sobre `AwardXpUseCase` (mesmo padrão de `accountProvisioner`, que só
// implementação concreta muda: engine via HTTP lá, gamification em processo
// aqui). Ver `.claude/arquitetura-backend-ddd-lite.md`.
export interface XpAwarder {
  award(userId: string, amount: number, reason: string): Promise<void>
}
