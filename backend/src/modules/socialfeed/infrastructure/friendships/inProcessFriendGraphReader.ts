import type { FriendshipRepository } from '../../../friendships/application/ports/friendshipRepository'
import type { FriendGraphReader } from '../../application/ports/friendGraphReader'

// Lê direto do repositório, não de `ListFriendsUseCase` — mesmo raciocínio
// de `modules/ranking`'s `inProcessFriendGraphReader.ts` (achado 6.9.1): o
// feed precisa do grafo de amigos completo, e `ListFriendsUseCase` é
// paginado.
export function createInProcessFriendGraphReader(
  friendshipRepository: FriendshipRepository,
): FriendGraphReader {
  return {
    async listAcceptedFriendIds(userId) {
      const accepted = await friendshipRepository.listAccepted(userId)
      return accepted.map((friendship) =>
        friendship.requesterId === userId ? friendship.addresseeId : friendship.requesterId,
      )
    },
  }
}
