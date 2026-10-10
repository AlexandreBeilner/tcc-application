import type { Achievement } from '../../domain/achievement'

// Aviso por e-mail de conquista rara (EM.7.2, E14). Port própria do módulo, implementada na
// composição por um adapter sobre `modules/notifications`: opt-in de engajamento e idempotência
// por conquista são decisão do adapter e do módulo de e-mail, não do caso de uso.
export interface AchievementMailer {
  sendRareUnlocked(input: { userId: string; achievement: Achievement }): Promise<void>
}
