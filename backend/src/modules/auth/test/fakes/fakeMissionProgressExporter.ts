import type {
  ExportedMissionProgress,
  MissionProgressExporter,
} from '../../application/ports/missionProgressExporter'

export function createFakeMissionProgressExporter(
  byUserId: Record<string, ExportedMissionProgress[]> = {},
): MissionProgressExporter {
  return {
    async exportForUser(userId) {
      return byUserId[userId] ?? []
    },
  }
}
