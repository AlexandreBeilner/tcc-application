import { newRequest, type Friendship } from '../../domain/friendship'
import { AddresseeNotFoundError, FriendshipAlreadyExistsError } from '../../domain/errors'
import { notifySafely } from '../notifySafely'
import type { FriendRequestMailer } from '../ports/friendRequestMailer'
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
    private readonly mailer: FriendRequestMailer,
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
      const accepted = await this.friendshipRepository.accept(existing.id)
      // Quem pediu primeiro (o destinatário de agora) é quem recebe o aviso de aceite.
      await notifySafely('o aviso de pedido de amizade aceito', () =>
        this.mailer.sendRequestAccepted({
          requesterId: addressee.id,
          accepterId: input.requesterId,
        }),
      )
      return accepted
    }

    const created = await this.friendshipRepository.create(input.requesterId, addressee.id)
    await notifySafely('o aviso de pedido de amizade', () =>
      this.mailer.sendRequestReceived({
        requesterId: input.requesterId,
        addresseeId: addressee.id,
      }),
    )
    return created
  }
}
