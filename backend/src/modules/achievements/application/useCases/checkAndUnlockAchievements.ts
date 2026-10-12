import { isSatisfied, type Achievement } from '../../domain/achievement'
import { notifySafely } from '../notifySafely'
import type { AchievementMailer } from '../ports/achievementMailer'
import type { AchievementRepository } from '../ports/achievementRepository'
import type { ProgressSnapshotReader } from '../ports/progressSnapshotReader'

export interface CheckAndUnlockAchievementsInput {
  userId: string
}

// Chamado em processo (mesmo padrão de xpAwarder/streakTracker) depois de
// qualquer ação que possa mudar o snapshot — crédito de xp (5.1), streak
// (5.3), conclusão de lição (5.6, credita xp/streak de qualquer forma) —
// nunca por polling. Ver gamification/infrastructure/achievements/ pro lado
// consumidor (AwardXpUseCase/TouchStreakUseCase chamam isto no final).
export class CheckAndUnlockAchievementsUseCase {
  constructor(
    private readonly achievementRepository: AchievementRepository,
    private readonly progressSnapshotReader: ProgressSnapshotReader,
    private readonly mailer: AchievementMailer,
  ) {}

  async execute(input: CheckAndUnlockAchievementsInput): Promise<Achievement[]> {
    const [catalog, unlocked, snapshot] = await Promise.all([
      this.achievementRepository.listCatalog(),
      this.achievementRepository.listUnlockedForUser(input.userId),
      this.progressSnapshotReader.getSnapshot(input.userId),
    ])
    const unlockedIds = new Set(unlocked.map((u) => u.achievementId))

    const newlyUnlocked: Achievement[] = []
    for (const achievement of catalog) {
      // Conquista desativada pelo painel (N.19) não é mais concedida; quem já a tem fica com ela.
      if (!achievement.isActive || unlockedIds.has(achievement.id)) {
        continue
      }
      if (isSatisfied(achievement.criteriaType, achievement.criteriaValue, snapshot)) {
        await this.achievementRepository.unlock(input.userId, achievement.id)
        newlyUnlocked.push(achievement)
      }
    }

    // E-mail de conquista rara (EM.7.2): só a que o catálogo marca como rara (ponto 044), depois
    // de gravar e nunca em volta do desbloqueio.
    for (const achievement of newlyUnlocked.filter((a) => a.isRare)) {
      await notifySafely('o aviso de conquista rara', () =>
        this.mailer.sendRareUnlocked({ userId: input.userId, achievement }),
      )
    }

    return newlyUnlocked
  }
}
