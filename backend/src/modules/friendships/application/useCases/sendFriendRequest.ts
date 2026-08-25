import { newRequest, type Friendship } from '../../domain/friendship'
import { AddresseeNotFoundError, FriendshipAlreadyExistsError } from '../../domain/errors'
import type { FriendshipRepository } from '../ports/friendshipRepository'
import type { UserDirectory } from '../ports/userDirectory'

export interface SendFriendRequestInput {
  requesterId: string
  addresseeUsername: string
}

export class SendFriendRequestUseCase {
  constructor(
    private readonly friendshipRepository: FriendshipRepository,
    private readonly userDirectory: UserDirectory,
  ) {}

  async execute(input: SendFriendRequestInput): Promise<Friendship> {
    const addressee = await this.userDirectory.findByUsername(input.addresseeUsername)
    if (!addressee) {
      throw new AddresseeNotFoundError('usuário não encontrado')
    }

    newRequest(input.requesterId, addressee.id)

    const existing = await this.friendshipRepository.findByPair(input.requesterId, addressee.id)
    if (existing) {
      if (existing.status === 'accepted') {
        throw new FriendshipAlreadyExistsError('vocês já são amigos')
      }
      if (existing.requesterId === input.requesterId) {
        throw new FriendshipAlreadyExistsError('solicitação já enviada')
      }
      // Pedido mútuo — decisão de escopo desta sessão, não confirmada
      // explicitamente: se o destinatário já tinha solicitado o inverso,
      // aceita automaticamente a solicitação existente em vez de criar uma
      // segunda linha (UX de "pedido mútuo vira amizade na hora"). Sinalizar
      // se a intenção for sempre exigir aceite explícito mesmo nesse caso.
      return this.friendshipRepository.accept(existing.id)
    }

    return this.friendshipRepository.create(input.requesterId, addressee.id)
  }
}
