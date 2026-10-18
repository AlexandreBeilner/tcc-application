import type { GetCompletedTracksUseCase } from '../../../lessons/application/useCases/getCompletedTracks'
import type { GetCompletedLessonCodesUseCase } from '../../../lessons/application/useCases/getCompletedLessonCodes'
import type { TrackCompletionReader } from '../../application/ports/trackCompletionReader'

export function createInProcessTrackCompletionReader(
  getCompletedTracks: GetCompletedTracksUseCase,
  getCompletedLessonCodes: GetCompletedLessonCodesUseCase,
): TrackCompletionReader {
  return {
    listCompleted(userId) {
      return getCompletedTracks.execute({ userId })
    },
    listCompletedLessonCodes(userId) {
      return getCompletedLessonCodes.execute({ userId })
    },
  }
}
