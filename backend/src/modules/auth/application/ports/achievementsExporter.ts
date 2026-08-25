// Port própria e mínima sobre `modules/achievements` (5.2) — implementada,
// na composição (app.ts), por um adapter em processo sobre
// `ExportUnlockedAchievementsUseCase`.
export interface ExportedAchievement {
  achievementId: string
  unlockedAt: Date
}

export interface AchievementsExporter {
  exportForUser(userId: string): Promise<ExportedAchievement[]>
}
