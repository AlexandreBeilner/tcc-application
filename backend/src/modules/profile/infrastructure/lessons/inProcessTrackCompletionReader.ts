import type { GetCompletedTracksUseCase } from '../../../lessons/application/useCases/getCompletedTracks'
import type { TrackCompletionReader } from '../../application/ports/trackCompletionReader'

export function createInProcessTrackCompletionReader(
  getCompletedTracks: GetCompletedTracksUseCase,
): TrackCompletionReader {
  return {
    listCompleted(userId) {
      return getCompletedTracks.execute({ userId })
    },
  }
}
