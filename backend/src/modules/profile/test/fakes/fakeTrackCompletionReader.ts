import type { TrackCompletionReader } from '../../application/ports/trackCompletionReader'

export function createFakeTrackCompletionReader(
  completedByUserId: Record<string, number[]> = {},
  lessonCodesByUserId: Record<string, string[]> = {},
): TrackCompletionReader {
  return {
    async listCompleted(userId) {
      return completedByUserId[userId] ?? []
    },
    async listCompletedLessonCodes(userId) {
      return lessonCodesByUserId[userId] ?? []
    },
  }
}
