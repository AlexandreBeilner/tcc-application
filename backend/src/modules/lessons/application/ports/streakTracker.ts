// Port própria e mínima sobre `modules/gamification` (5.3) — implementada,
// na composição (app.ts), por um adapter em processo sobre
// `TouchStreakUseCase`. Ver `xpAwarder.ts` (mesma decisão de composição).
export interface StreakTracker {
  touch(userId: string): Promise<void>
}
