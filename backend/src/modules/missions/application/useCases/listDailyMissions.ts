import { buildMissionView, todayUtc, type MissionView } from '../../domain/mission'
import type { MissionRepository } from '../ports/missionRepository'

export interface ListDailyMissionsInput {
  userId: string
}

export class ListDailyMissionsUseCase {
  constructor(private readonly missionRepository: MissionRepository) {}

  async execute(input: ListDailyMissionsInput): Promise<MissionView[]> {
    const today = todayUtc(new Date())
    const catalog = await this.missionRepository.listCatalog()

    // Gera/lê a linha `pending` de hoje sob demanda, no primeiro GET do
    // dia — evita um job de meia-noite só pra isso.
    await this.missionRepository.ensureTodayProgress(
      input.userId,
      catalog.map((mission) => mission.id),
      today,
    )
    const progress = await this.missionRepository.listProgressForDate(input.userId, today)
    const progressByMissionId = new Map(progress.map((p) => [p.missionId, p]))

    return catalog.map((mission) => buildMissionView(mission, progressByMissionId.get(mission.id)))
  }
}
