import type { MissionProgressExportRecord, MissionRepository } from '../ports/missionRepository'

export interface ExportMissionProgressInput {
  userId: string
}

// Consumida em processo pelo módulo `auth` (5.11, portabilidade RNF04) —
// todo o histórico de missões do usuário, não só o dia corrente (diferente
// de `ListDailyMissionsUseCase`).
export class ExportMissionProgressUseCase {
  constructor(private readonly missionRepository: MissionRepository) {}

  async execute(input: ExportMissionProgressInput): Promise<MissionProgressExportRecord[]> {
    return this.missionRepository.listAllProgressForUser(input.userId)
  }
}
