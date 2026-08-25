import type { FriendshipRepository } from '../ports/friendshipRepository'
import type { UserDirectory } from '../ports/userDirectory'

export interface FriendRequestItem {
  friendshipId: string
  userId: string
  username: string
  name: string
  createdAt: Date
}

export interface ListFriendRequestsInput {
  userId: string
}

export interface ListFriendRequestsResult {
  received: FriendRequestItem[]
  sent: FriendRequestItem[]
}

export class ListFriendRequestsUseCase {
  constructor(
    private readonly friendshipRepository: FriendshipRepository,
    private readonly userDirectory: UserDirectory,
  ) {}

  async execute(input: ListFriendRequestsInput): Promise<ListFriendRequestsResult> {
    const [receivedRows, sentRows] = await Promise.all([
      this.friendshipRepository.listReceivedPending(input.userId),
      this.friendshipRepository.listSentPending(input.userId),
    ])

    const received = await this.toItems(receivedRows, (friendship) => friendship.requesterId)
    const sent = await this.toItems(sentRows, (friendship) => friendship.addresseeId)

    return { received, sent }
  }

  private async toItems(
    rows: Awaited<ReturnType<FriendshipRepository['listReceivedPending']>>,
    otherUserId: (friendship: (typeof rows)[number]) => string,
  ): Promise<FriendRequestItem[]> {
    const items = await Promise.all(
      rows.map(async (friendship) => {
        const user = await this.userDirectory.findById(otherUserId(friendship))
        if (!user) {
          return undefined
        }
        return {
          friendshipId: friendship.id,
          userId: user.id,
          username: user.username,
          name: user.name,
          createdAt: friendship.createdAt,
        }
      }),
    )
    return items.filter((item): item is FriendRequestItem => item !== undefined)
  }
}
