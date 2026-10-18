// Recém-desbloqueada nesta chamada; recorte mínimo duplicado do tipo de `modules/gamification`
// (portas próprias por módulo, sem import cruzado, como em `missions`).
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

export interface XpAwarder {
  award(userId: string, amount: number, reason: string): Promise<XpAwardResult>
}
