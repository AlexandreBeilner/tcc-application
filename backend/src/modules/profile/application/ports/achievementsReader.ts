// Port própria e mínima sobre `modules/achievements` (5.2) — implementada,
// na composição (app.ts), por um adapter em processo sobre
// `ListAchievementsUseCase`, filtrando só as desbloqueadas (RF20 só pede
// "conquistas", não progresso das bloqueadas — isso é tela 7.2, não 8.4).
export interface UnlockedAchievementSummary {
  id: string
  name: string
  description: string | null
  unlockedAt: Date
}

export interface AchievementsReader {
  listUnlocked(userId: string): Promise<UnlockedAchievementSummary[]>
}
