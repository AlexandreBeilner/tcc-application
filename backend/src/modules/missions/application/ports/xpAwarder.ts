// Recém-desbloqueada nesta chamada — recorte mínimo duplicado do tipo real
// de `modules/gamification` (`AchievementChecker.UnlockedAchievement`),
// mesma decisão de `lessons/application/ports/xpAwarder.ts` (portas
// próprias e independentes por módulo, sem import cruzado).
export interface UnlockedAchievement {
  id: string
  name: string
  description: string | null
}

export interface XpAwardResult {
  xp: number
  level: number
  leveledUp: boolean
  unlockedAchievements: UnlockedAchievement[]
}

// Port própria e mínima sobre `modules/gamification` (5.1) — mesmo padrão
// de `lessons/application/ports/xpAwarder.ts` (adapter em processo sobre
// `AwardXpUseCase`, decisão de composição em `app.ts`). Devolve o resultado
// real (tarefa I.2 do backlog de engajamento — antes `Promise<void>`).
export interface XpAwarder {
  award(userId: string, amount: number, reason: string): Promise<XpAwardResult>
}
