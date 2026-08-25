import type { ListFriendsUseCase } from '../../../friendships/application/useCases/listFriends'
import type { FriendGraphReader } from '../../application/ports/friendGraphReader'

export function createInProcessFriendGraphReader(
  listFriends: ListFriendsUseCase,
): FriendGraphReader {
  return {
    async listAcceptedFriendIds(userId) {
      const friends = await listFriends.execute({ userId })
      return friends.map((friend) => friend.userId)
    },
  }
}
