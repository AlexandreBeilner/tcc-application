// Recém-desbloqueada nesta chamada — recorte mínimo duplicado do tipo real
// de `modules/gamification` (`AchievementChecker.UnlockedAchievement`),
// mesma decisão de portas próprias e independentes por módulo já usada em
// `xpAwarder`/`streakTracker` (ver comentário abaixo).
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

// Port própria e mínima sobre o crédito de xp de `modules/gamification`
// (5.1) — implementada, na composição (app.ts), por um adapter em processo
// sobre `AwardXpUseCase` (mesmo padrão de `accountProvisioner`, que só
// implementação concreta muda: engine via HTTP lá, gamification em processo
// aqui). Ver `.claude/arquitetura-backend-ddd-lite.md`. Devolve o resultado
// real de `AwardXpUseCase` (tarefa I.2 do backlog de engajamento — antes
// `Promise<void>`, descartando xp/nível/level-up/conquistas que o "teatro
// de recompensa" da I.1 precisa pra disparar em tempo real).
export interface XpAwarder {
  award(userId: string, amount: number, reason: string): Promise<XpAwardResult>
}
