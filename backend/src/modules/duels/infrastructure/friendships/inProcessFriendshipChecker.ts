import type { FriendshipRepository } from '../../../friendships/application/ports/friendshipRepository'
import type { FriendshipChecker } from '../../application/ports/friendshipChecker'

// Ponte em processo para o módulo `friendships`: só vale amizade aceita, em qualquer direção.
export function createInProcessFriendshipChecker(
  friendships: Pick<FriendshipRepository, 'findByPair'>,
): FriendshipChecker {
  return {
    async areFriends(userAId, userBId) {
      const friendship = await friendships.findByPair(userAId, userBId)
      return friendship?.status === 'accepted'
    },
  }
}
