import type {
  AchievementRepository,
  UnlockedAchievementRecord,
} from '../ports/achievementRepository'

export interface ExportUnlockedAchievementsInput {
  userId: string
}

// Consumida em processo pelo módulo `auth` (5.11, portabilidade RNF04) —
// reaproveita `listUnlockedForUser` direto, sem juntar com o catálogo
// (a exportação é o dump da tabela `user_achievements`, não uma visão de UI).
export class ExportUnlockedAchievementsUseCase {
  constructor(private readonly achievementRepository: AchievementRepository) {}

  async execute(input: ExportUnlockedAchievementsInput): Promise<UnlockedAchievementRecord[]> {
    return this.achievementRepository.listUnlockedForUser(input.userId)
  }
}
