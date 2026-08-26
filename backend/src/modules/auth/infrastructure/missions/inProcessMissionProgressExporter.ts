import type { ExportMissionProgressUseCase } from '../../../missions/application/useCases/exportMissionProgress'
import type { MissionProgressExporter } from '../../application/ports/missionProgressExporter'

export function createInProcessMissionProgressExporter(
  exportMissionProgress: ExportMissionProgressUseCase,
): MissionProgressExporter {
  return {
    async exportForUser(userId) {
      return exportMissionProgress.execute({ userId })
    },
  }
}
