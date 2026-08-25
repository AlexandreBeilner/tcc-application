// Port própria e mínima sobre `modules/gamification` (5.1/5.3) — implementada,
// na composição (app.ts), por um adapter em processo sobre `GetProgressionUseCase`.
export interface UserGamificationSummary {
  level: number
  xp: number
  currentStreak: number
}

export interface GamificationReader {
  getSummary(userId: string): Promise<UserGamificationSummary>
}
