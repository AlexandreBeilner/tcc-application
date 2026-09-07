import type { TrackCompletionReader } from '../../application/ports/trackCompletionReader'

export function createFakeTrackCompletionReader(
  completedByUserId: Record<string, number[]> = {},
): TrackCompletionReader {
  return {
    async listCompleted(userId) {
      return completedByUserId[userId] ?? []
    },
  }
}
