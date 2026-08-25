import type {
  ExportedProgression,
  ProgressionExporter,
} from '../../application/ports/progressionExporter'

const DEFAULT: ExportedProgression = {
  xp: 0,
  level: 1,
  currentStreak: 0,
  longestStreak: 0,
  lastQualifyingActivityDate: null,
}

export function createFakeProgressionExporter(
  byUserId: Record<string, ExportedProgression> = {},
): ProgressionExporter {
  return {
    async exportForUser(userId) {
      return byUserId[userId] ?? DEFAULT
    },
  }
}
