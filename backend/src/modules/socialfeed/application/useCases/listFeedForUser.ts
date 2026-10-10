import {
  NO_COSMETICS,
  type CosmeticsReader,
  type PublicCosmetics,
} from '../../../../shared/publicCosmetics'
import type { SocialFeedEventType } from '../../domain/socialFeedEvent'
import type { FriendGraphReader } from '../ports/friendGraphReader'
import type { SocialFeedEventRepository } from '../ports/socialFeedEventRepository'
import type { UserDirectory } from '../ports/userDirectory'

export interface ListFeedForUserInput {
  userId: string
}

export interface SocialFeedItem {
  type: SocialFeedEventType
  trackNumber: number | null
  occurredAt: Date
  userId: string
  username: string
  name: string
  avatarUrl: string | null
  cosmetics: PublicCosmetics
}

// Mesmo teto de `FRIENDS_PAGE_SIZE` (`modules/friendships`) — não é
// paginação de verdade, só um limite de segurança pra uma seção de
// "atividade recente", não uma lista navegável.
const SOCIAL_FEED_LIMIT = 20

export class ListFeedForUserUseCase {
  constructor(
    private readonly friendGraphReader: FriendGraphReader,
    private readonly socialFeedEventRepository: SocialFeedEventRepository,
    private readonly userDirectory: UserDirectory,
    private readonly cosmeticsReader?: CosmeticsReader,
  ) {}

  async execute(input: ListFeedForUserInput): Promise<SocialFeedItem[]> {
    const friendIds = await this.friendGraphReader.listAcceptedFriendIds(input.userId)
    if (friendIds.length === 0) {
      return []
    }

    const [events, users] = await Promise.all([
      this.socialFeedEventRepository.listForUsers(friendIds, SOCIAL_FEED_LIMIT),
      this.userDirectory.findByIds(friendIds),
    ])
    const userById = new Map(users.map((user) => [user.id, user]))
    const displays =
      (await this.cosmeticsReader?.findDisplays(friendIds)) ?? new Map<string, PublicCosmetics>()

    return events
      .map((event): SocialFeedItem | undefined => {
        const user = userById.get(event.userId)
        if (!user) {
          return undefined
        }
        return {
          type: event.type,
          trackNumber: event.trackNumber,
          occurredAt: event.occurredAt,
          userId: event.userId,
          username: user.username,
          name: user.name,
          avatarUrl: user.avatarUrl,
          cosmetics: displays.get(event.userId) ?? NO_COSMETICS,
        }
      })
      .filter((item): item is SocialFeedItem => item !== undefined)
  }
}
