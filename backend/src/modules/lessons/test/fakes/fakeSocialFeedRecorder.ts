import type { SocialFeedRecorder } from '../../application/ports/socialFeedRecorder'

export interface FakeSocialFeedRecorder extends SocialFeedRecorder {
  recorded: { userId: string; trackNumber: number }[]
}

export function createFakeSocialFeedRecorder(): FakeSocialFeedRecorder {
  const recorded: { userId: string; trackNumber: number }[] = []
  return {
    recorded,
    async recordTrackCompleted(userId, trackNumber) {
      recorded.push({ userId, trackNumber })
    },
  }
}
