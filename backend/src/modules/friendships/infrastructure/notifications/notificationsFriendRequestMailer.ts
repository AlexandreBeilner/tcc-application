import type { EnqueueEmailUseCase } from '../../../notifications/application/useCases/enqueueEmail'
import type { RecipientDirectory } from '../../../notifications/application/ports/recipientDirectory'
import type { FriendProfileReader } from '../../application/ports/friendProfileReader'
import type { FriendRequestMailer } from '../../application/ports/friendRequestMailer'
import type { UserDirectory } from '../../application/ports/userDirectory'

export interface NotificationsFriendRequestMailerOptions {
  enqueueEmail: Pick<EnqueueEmailUseCase, 'execute' | 'acceptsOptional'>
  recipients: RecipientDirectory
  userDirectory: UserDirectory
  profiles: FriendProfileReader
  now?: () => Date
}

// Dia no fuso de Brasília (`2026-10-10`): é a janela do teto de "1 e-mail social por dia".
function brasiliaDay(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

// Liga a port `FriendRequestMailer` ao módulo `notifications` (EM.6.2, E8). Categoria `social`:
// só sai para quem ligou "Amigos" em Configurações ou no onboarding, com e-mail verificado e conta
// ativa (o `EnqueueEmailUseCase` decide).
//
// Teto de 1 e-mail social por destinatário por dia: a chave de idempotência é `social-daily:
// <destinatário>:<dia>`, sem o id do pedido, então pedidos e aceites a mais no mesmo dia viram
// `duplicate` no outbox em vez de outro e-mail (contra spam usando o nosso domínio: qualquer
// usuário pode pedir amizade a qualquer outro). O pedido continua visível na tela de solicitações.
//
// RNF09: o e-mail leva só username, nível e rentabilidade percentual da semana de quem pediu ou
// aceitou, nunca patrimônio. A leitura de nível e rentabilidade só acontece depois de saber que o
// destinatário aceita o e-mail (quase ninguém, pois tudo nasce desligado).
export function createNotificationsFriendRequestMailer(
  options: NotificationsFriendRequestMailerOptions,
): FriendRequestMailer {
  const now = options.now ?? (() => new Date())

  async function notify(
    templateKey: 'friend_request_received' | 'friend_request_accepted',
    recipientId: string,
    friendId: string,
  ): Promise<void> {
    if (!(await options.enqueueEmail.acceptsOptional(recipientId, 'social'))) return

    const [recipient, users] = await Promise.all([
      options.recipients.find(recipientId),
      options.userDirectory.findByIds([recipientId, friendId]),
    ])
    const friend = users.find((user) => user.id === friendId)
    if (!recipient || !friend) return
    const recipientName = users.find((user) => user.id === recipientId)?.name

    const stats = await options.profiles.read(friendId)

    await options.enqueueEmail.execute({
      userId: recipientId,
      to: recipient.address,
      templateKey,
      category: 'social',
      payload: {
        name: recipientName,
        friendUsername: friend.username,
        ...(stats ? { level: stats.level, returnPct: stats.profitabilityPct } : {}),
      },
      idempotencyKey: `social-daily:${recipientId}:${brasiliaDay(now())}`,
    })
  }

  return {
    sendRequestReceived: ({ requesterId, addresseeId }) =>
      notify('friend_request_received', addresseeId, requesterId),
    sendRequestAccepted: ({ requesterId, accepterId }) =>
      notify('friend_request_accepted', requesterId, accepterId),
  }
}
