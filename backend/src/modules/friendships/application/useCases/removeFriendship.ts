import { FriendshipNotFoundError, NotAuthorizedError } from '../../domain/errors'
import type { FriendshipRepository } from '../ports/friendshipRepository'

export interface RemoveFriendshipInput {
  friendshipId: string
  userId: string
}

// Cobre recusar (spec 8.4, pelo addressee), cancelar (pelo requester) e,
// desde a 6.9.3, desfazer uma amizade já aceita (reabre a decisão de
// escopo original da 5.8, "unfriend não está no escopo desta tarefa") —
// as três ações são, na prática, a mesma operação de domínio (remover a
// linha de amizade entre duas pessoas), só o rótulo do botão muda
// conforme a tela/status; a autorização decide aqui dentro quem pode
// fazer o quê, em vez de rotas separadas (`DELETE /friendships/:id`
// cobre as três).
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

    await this.friendshipRepository.remove(input.friendshipId)
  }
}
