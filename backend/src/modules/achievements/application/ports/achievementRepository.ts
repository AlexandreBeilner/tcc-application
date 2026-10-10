import type { Achievement } from '../../domain/achievement'
import type { AchievementDraft } from '../../domain/catalog'

export interface UnlockedAchievementRecord {
  achievementId: string
  unlockedAt: Date
}

// Campos que o painel edita (N.19). `isActive` é só liga/desliga; nunca remove o que o
// usuário já ganhou.
export type AchievementPatch = Partial<AchievementDraft> & { isActive?: boolean }

export interface AchievementRepository {
  // Catálogo completo, inclusive conquista desativada: quem usa filtra por `isActive`
  // conforme o caso (a checagem de desbloqueio ignora as desativadas; a lista do jogador
  // mostra a desativada só pra quem já a ganhou).
  listCatalog(): Promise<Achievement[]>
  findById(id: string): Promise<Achievement | undefined>
  // Cadastro pelo painel (N.19): nasce ativa, sem `seed_key`.
  create(draft: AchievementDraft): Promise<Achievement>
  // Devolve a conquista já atualizada, ou `undefined` se o id não existe.
  update(id: string, patch: AchievementPatch): Promise<Achievement | undefined>
  // Quantos usuários têm cada conquista (id da conquista → contagem); só as com ao menos um.
  countUnlockedByAchievement(): Promise<Map<string, number>>
  listUnlockedForUser(userId: string): Promise<UnlockedAchievementRecord[]>
  // Idempotente sobre o UNIQUE(user_id, achievement_id) já existente em
  // user_achievements (Figura 10 do DER) — desbloquear a mesma conquista
  // duas vezes não duplica nem falha.
  unlock(userId: string, achievementId: string): Promise<void>
}
