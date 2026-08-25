import type { FriendshipRepository } from '../ports/friendshipRepository'
import type { UserDirectory } from '../ports/userDirectory'

export interface FriendListItem {
  userId: string
  username: string
  name: string
  friendsSince: Date | null
}

export interface ListFriendsInput {
  userId: string
}

export class ListFriendsUseCase {
  constructor(
    private readonly friendshipRepository: FriendshipRepository,
    private readonly userDirectory: UserDirectory,
  ) {}

  async execute(input: ListFriendsInput): Promise<FriendListItem[]> {
    const accepted = await this.friendshipRepository.listAccepted(input.userId)

    const items = await Promise.all(
      accepted.map(async (friendship) => {
        const otherUserId =
          friendship.requesterId === input.userId ? friendship.addresseeId : friendship.requesterId
        const user = await this.userDirectory.findById(otherUserId)
        if (!user) {
          return undefined
        }
        return {
          userId: user.id,
          username: user.username,
          name: user.name,
          friendsSince: friendship.respondedAt,
        }
      }),
    )

    return items.filter((item): item is FriendListItem => item !== undefined)
  }
}
