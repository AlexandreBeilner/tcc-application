import {
  AchievementAlreadyUnlockedError,
  AchievementNotFoundError,
  AchievementNotUnlockedError,
} from '../../domain/errors'
import type { Achievement } from '../../domain/achievement'
import type { AchievementRepository } from '../ports/achievementRepository'

// Concede uma conquista na mão (N.17), sem checar o critério: é correção de suporte.
// Idempotente no banco, mas aqui devolve conflito pra o admin saber que nada mudou.
export class GrantAchievementUseCase {
  constructor(private readonly achievementRepository: AchievementRepository) {}

  async execute(userId: string, achievementId: string): Promise<Achievement> {
    const catalog = await this.achievementRepository.listCatalog()
    const achievement = catalog.find((a) => a.id === achievementId)
    if (!achievement) throw new AchievementNotFoundError('conquista não encontrada')

    const unlocked = await this.achievementRepository.listUnlockedForUser(userId)
    if (unlocked.some((u) => u.achievementId === achievementId)) {
      throw new AchievementAlreadyUnlockedError('o usuário já tem essa conquista')
    }
    await this.achievementRepository.unlock(userId, achievementId)
    return achievement
  }
}

// Revoga uma conquista (N.17). Atenção: se o usuário ainda satisfaz o critério, a
// próxima checagem automática (XP, streak, lição) a concede de novo; revogar só
// "fica" quando a conquista foi dada por engano.
export class RevokeAchievementUseCase {
  constructor(private readonly achievementRepository: AchievementRepository) {}

  async execute(userId: string, achievementId: string): Promise<Achievement> {
    const catalog = await this.achievementRepository.listCatalog()
    const achievement = catalog.find((a) => a.id === achievementId)
    if (!achievement) throw new AchievementNotFoundError('conquista não encontrada')

    const removed = await this.achievementRepository.revoke(userId, achievementId)
    if (!removed) throw new AchievementNotUnlockedError('o usuário não tem essa conquista')
    return achievement
  }
}
