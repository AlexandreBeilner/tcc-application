import type { FriendshipRepository } from '../../../friendships/application/ports/friendshipRepository'
import type { FriendGraphReader } from '../../application/ports/friendGraphReader'

// Lê direto do repositório, não de `ListFriendsUseCase` (achado da 6.9.1)
// — o ranking precisa do grafo de amigos completo pra filtrar o escopo
// Amigos corretamente, e o caso de uso de listagem virou paginado
// (`FRIENDS_PAGE_SIZE`), o que cortaria o grafo pra quem tem mais amigos
// que uma página. Paginação é preocupação de apresentação (tela 8.1),
// não do consumo interno entre módulos.
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
