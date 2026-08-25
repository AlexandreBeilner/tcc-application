import type { Friendship } from '../../domain/friendship'

export interface FriendshipRepository {
  // Busca o par em qualquer direção (A→B ou B→A) — usado tanto pra checar
  // duplicidade quanto pra detectar pedido mútuo (SendFriendRequestUseCase).
  findByPair(userAId: string, userBId: string): Promise<Friendship | undefined>
  findById(id: string): Promise<Friendship | undefined>
  create(requesterId: string, addresseeId: string): Promise<Friendship>
  accept(id: string): Promise<Friendship>
  remove(id: string): Promise<void>
  listAccepted(userId: string): Promise<Friendship[]>
  listReceivedPending(userId: string): Promise<Friendship[]>
  listSentPending(userId: string): Promise<Friendship[]>
}
