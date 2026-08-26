import {
  FriendshipNotFoundError,
  FriendshipNotPendingError,
  NotAuthorizedError,
} from '../../domain/errors'
import type { FriendshipRepository } from '../ports/friendshipRepository'

export interface RemoveFriendshipInput {
  friendshipId: string
  userId: string
}

// Cobre recusar (spec 8.4, pelo addressee) e cancelar (pelo requester) —
// decisão de escopo desta sessão, não confirmada explicitamente: as duas
// ações são, na prática, a mesma operação de domínio (remover uma
// solicitação pendente), só o autor autorizado muda; a autorização decide
// aqui dentro qual dos dois é válido pra quem chama, em vez de duas rotas
// (`DELETE /friendships/:id` cobre ambas). Não remove amizade já aceita
// (unfriend não está no escopo desta tarefa).
export class RemoveFriendshipUseCase {
  constructor(private readonly friendshipRepository: FriendshipRepository) {}

  async execute(input: RemoveFriendshipInput): Promise<void> {
    const friendship = await this.friendshipRepository.findById(input.friendshipId)
    if (!friendship) {
      throw new FriendshipNotFoundError('solicitação não encontrada')
    }
    const isRequester = friendship.requesterId === input.userId
    const isAddressee = friendship.addresseeId === input.userId
    if (!isRequester && !isAddressee) {
      throw new NotAuthorizedError('só quem enviou ou recebeu a solicitação pode removê-la')
    }
    if (friendship.status !== 'pending') {
      throw new FriendshipNotPendingError(
        'só é possível recusar ou cancelar solicitações pendentes',
      )
    }

    await this.friendshipRepository.remove(input.friendshipId)
  }
}
