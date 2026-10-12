import type {
  SocialFeedData,
  SocialFeedEvent,
  SocialFeedEventType,
} from '../../domain/socialFeedEvent'
import type { SocialFeedEventRepository } from '../../application/ports/socialFeedEventRepository'

export function createFakeSocialFeedEventRepository(): SocialFeedEventRepository & {
  events: SocialFeedEvent[]
} {
  const events: SocialFeedEvent[] = []
  return {
    events,
    async record(userId, type: SocialFeedEventType, trackNumber, data?: SocialFeedData) {
      events.push({
        id: `event-${events.length + 1}`,
        userId,
        type,
        trackNumber,
        data: data ?? null,
        occurredAt: new Date(),
      })
    },
    async recordAssemblyParticipation(userId, data) {
      const exists = events.some(
        (e) =>
          e.userId === userId &&
          e.type === 'assembly_participated' &&
          (e.data as { assemblyId?: string } | null)?.assemblyId === data.assemblyId,
      )
      if (exists) return
      events.push({
        id: `event-${events.length + 1}`,
        userId,
        type: 'assembly_participated',
        trackNumber: null,
        data,
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
