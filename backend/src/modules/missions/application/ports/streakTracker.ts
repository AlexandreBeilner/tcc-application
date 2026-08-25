// Port própria e mínima sobre `modules/gamification` (5.3) — conclusão de
// **qualquer** missão mantém o streak, consistente com a decisão da 5.3
// (não exige todas as missões do dia).
export interface StreakTracker {
  touch(userId: string): Promise<void>
}
