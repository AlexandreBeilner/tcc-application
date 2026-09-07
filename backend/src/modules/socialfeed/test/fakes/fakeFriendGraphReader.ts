import type { FriendGraphReader } from '../../application/ports/friendGraphReader'

export function createFakeFriendGraphReader(
  friendsByUserId: Record<string, string[]> = {},
): FriendGraphReader {
  return {
    async listAcceptedFriendIds(userId) {
      return friendsByUserId[userId] ?? []
    },
  }
}
