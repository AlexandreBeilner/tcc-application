import type { FriendGraphReader } from '../../application/ports/friendGraphReader'

export function createFakeFriendGraphReader(
  friendIdsByUserId: Record<string, string[]> = {},
): FriendGraphReader {
  return {
    async listAcceptedFriendIds(userId) {
      return friendIdsByUserId[userId] ?? []
    },
  }
}
