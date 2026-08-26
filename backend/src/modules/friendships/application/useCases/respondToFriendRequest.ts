import type { Friendship } from '../../domain/friendship'
import { FriendshipNotFoundError, NotAuthorizedError } from '../../domain/errors'
import type { FriendshipRepository } from '../ports/friendshipRepository'

export interface RespondToFriendRequestInput {
  friendshipId: string
  userId: string
}

export class RespondToFriendRequestUseCase {
  constructor(private readonly friendshipRepository: FriendshipRepository) {}

  async execute(input: RespondToFriendRequestInput): Promise<Friendship> {
    const friendship = await this.friendshipRepository.findById(input.friendshipId)
    if (!friendship) {
      throw new FriendshipNotFoundError('solicitação não encontrada')
    }
    if (friendship.addresseeId !== input.userId) {
      throw new NotAuthorizedError('só o destinatário pode aceitar a solicitação')
    }
    if (friendship.status === 'accepted') {
      // Idempotente — aceitar duas vezes não falha, só confirma o estado.
      return friendship
    }

    return this.friendshipRepository.accept(input.friendshipId)
  }
}
