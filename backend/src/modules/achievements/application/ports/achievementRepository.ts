import type { Achievement } from '../../domain/achievement'

export interface UnlockedAchievementRecord {
  achievementId: string
  unlockedAt: Date
}

export interface AchievementRepository {
  listCatalog(): Promise<Achievement[]>
  listUnlockedForUser(userId: string): Promise<UnlockedAchievementRecord[]>
  // Idempotente sobre o UNIQUE(user_id, achievement_id) já existente em
  // user_achievements (Figura 10 do DER) — desbloquear a mesma conquista
  // duas vezes não duplica nem falha.
  unlock(userId: string, achievementId: string): Promise<void>
  // Remove a conquista do usuário (correção manual do painel, N.17); `false` se ele
  // não a tinha. Só o painel revoga: nenhum fluxo normal desfaz uma conquista.
  revoke(userId: string, achievementId: string): Promise<boolean>
}
