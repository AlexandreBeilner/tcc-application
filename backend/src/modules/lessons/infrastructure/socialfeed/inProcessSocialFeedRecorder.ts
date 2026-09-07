import type { RecordTrackCompletedUseCase } from '../../../socialfeed/application/useCases/recordTrackCompleted'
import type { SocialFeedRecorder } from '../../application/ports/socialFeedRecorder'

export function createInProcessSocialFeedRecorder(
  recordTrackCompleted: RecordTrackCompletedUseCase,
): SocialFeedRecorder {
  return {
    async recordTrackCompleted(userId, trackNumber) {
      await recordTrackCompleted.execute({ userId, trackNumber })
    },
  }
}
