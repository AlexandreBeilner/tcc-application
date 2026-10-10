import type { Friendship } from '../../domain/friendship'
import { FriendshipNotFoundError, NotAuthorizedError } from '../../domain/errors'
import { notifySafely } from '../notifySafely'
import type { FriendRequestMailer } from '../ports/friendRequestMailer'
import type { FriendshipRepository } from '../ports/friendshipRepository'

export interface RespondToFriendRequestInput {
  friendshipId: string
  userId: string
}

export class RespondToFriendRequestUseCase {
  constructor(
    private readonly friendshipRepository: FriendshipRepository,
    private readonly mailer: FriendRequestMailer,
  ) {}

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

    const accepted = await this.friendshipRepository.accept(input.friendshipId)
    await notifySafely('o aviso de pedido de amizade aceito', () =>
      this.mailer.sendRequestAccepted({
        requesterId: friendship.requesterId,
        accepterId: input.userId,
      }),
    )
    return accepted
  }
}
