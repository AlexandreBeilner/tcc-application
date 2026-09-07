import type { SocialFeedEvent, SocialFeedEventType } from '../../domain/socialFeedEvent'
import type { SocialFeedEventRepository } from '../../application/ports/socialFeedEventRepository'

export function createFakeSocialFeedEventRepository(): SocialFeedEventRepository & {
  events: SocialFeedEvent[]
} {
  const events: SocialFeedEvent[] = []
  return {
    events,
    async record(userId, type: SocialFeedEventType, trackNumber) {
      events.push({
        id: `event-${events.length + 1}`,
        userId,
        type,
        trackNumber,
        occurredAt: new Date(),
      })
    },
    async listForUsers(userIds, limit) {
      return events
        .filter((event) => userIds.includes(event.userId))
        .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
        .slice(0, limit)
    },
  }
}
