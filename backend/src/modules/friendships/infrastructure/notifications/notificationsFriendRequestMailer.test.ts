import { describe, expect, it } from 'vitest'
import { EnqueueEmailUseCase } from '../../../notifications/application/useCases/enqueueEmail'
import { createFakeEmailOutboxRepository } from '../../../notifications/test/fakes/fakeEmailOutboxRepository'
import { createFakeEmailPreferencesRepository } from '../../../notifications/test/fakes/fakeEmailPreferencesRepository'
import { createFakeEmailSuppressionRepository } from '../../../notifications/test/fakes/fakeEmailSuppressionRepository'
import { createFakeRecipientDirectory } from '../../../notifications/test/fakes/fakeRecipientDirectory'
import { createFakeUnsubscribeLinks } from '../../../notifications/test/fakes/fakeUnsubscribe'
import type { FriendProfileReader } from '../../application/ports/friendProfileReader'
import { createFakeUserDirectory } from '../../test/fakes/fakeUserDirectory'
import { createNotificationsFriendRequestMailer } from './notificationsFriendRequestMailer'

const alice = { id: 'u-alice', username: 'alice', name: 'Alice', avatarUrl: null }
const bob = { id: 'u-bob', username: 'bob', name: 'Bob', avatarUrl: null }
const eligible = (address: string) => ({ address, status: 'active' as const, emailVerified: true })

function setup(
  options: {
    bobOptedIn?: boolean
    stats?: { level: number; profitabilityPct: number } | null
  } = {},
) {
  const {
    bobOptedIn = true,
    aliceOptedIn = false,
    stats = { level: 12, profitabilityPct: 3.24 },
  } = options
  const outbox = createFakeEmailOutboxRepository()
  const readProfiles: string[] = []
  let clock = new Date('2026-10-10T15:00:00Z')
  const profiles: FriendProfileReader = {
    async read(userId) {
      readProfiles.push(userId)
      return stats
    },
  }
  const mailer = createNotificationsFriendRequestMailer({
    enqueueEmail: new EnqueueEmailUseCase(outbox, createFakeEmailSuppressionRepository(), {
      preferences: createFakeEmailPreferencesRepository({
        'u-bob': { social: bobOptedIn },
        'u-alice': { social: aliceOptedIn },
      }),
      recipients: createFakeRecipientDirectory({
        'u-alice': eligible('alice@exemplo.com'),
        'u-bob': eligible('bob@exemplo.com'),
      }),
      unsubscribeLinks: createFakeUnsubscribeLinks(),
    }),
    recipients: createFakeRecipientDirectory({
      'u-alice': eligible('alice@exemplo.com'),
      'u-bob': eligible('bob@exemplo.com'),
    }),
    userDirectory: createFakeUserDirectory([alice, bob]),
    profiles,
    now: () => clock,
  })
  return { mailer, outbox, readProfiles, setClock: (date: Date) => (clock = date) }
}

describe('notificationsFriendRequestMailer (EM.6.2)', () => {
  it('pedido recebido: enfileira para o destinatário opt-in com username, nível e percentual', async () => {
    const { mailer, outbox } = setup()

    await mailer.sendRequestReceived({ requesterId: 'u-alice', addresseeId: 'u-bob' })

    expect(outbox.rows).toHaveLength(1)
    expect(outbox.rows[0]).toMatchObject({
      userId: 'u-bob',
      toAddress: 'bob@exemplo.com',
      templateKey: 'friend_request_received',
      category: 'social',
      status: 'pending',
    })
    expect(outbox.rows[0].payload).toEqual({
      name: 'Bob',
      friendUsername: 'alice',
      level: 12,
      returnPct: 3.24,
      unsubscribeUrl: 'https://api.test/email/unsubscribe?token=u-bob|social',
    })
  })

  it('RNF09: o payload nunca carrega patrimônio, saldo ou valor absoluto', async () => {
    const { mailer, outbox } = setup()

    await mailer.sendRequestReceived({ requesterId: 'u-alice', addresseeId: 'u-bob' })

    expect(Object.keys(outbox.rows[0].payload).sort()).toEqual(
      ['friendUsername', 'level', 'name', 'returnPct', 'unsubscribeUrl'].sort(),
    )
  })

  it('aceite: o aviso vai para quem pediu, com os dados de quem aceitou', async () => {
    const { mailer, outbox } = setup({
      aliceOptedIn: true,
      stats: { level: 3, profitabilityPct: -1.5 },
    })

    await mailer.sendRequestAccepted({ requesterId: 'u-alice', accepterId: 'u-bob' })

    expect(outbox.rows).toHaveLength(1)
    expect(outbox.rows[0]).toMatchObject({
      userId: 'u-alice',
      toAddress: 'alice@exemplo.com',
      templateKey: 'friend_request_accepted',
    })
    expect(outbox.rows[0].payload).toMatchObject({
      friendUsername: 'bob',
      level: 3,
      returnPct: -1.5,
    })
  })

  it('destinatário que não ligou "Amigos" (o padrão) não recebe e nem se lê o perfil de quem pediu', async () => {
    const { mailer, outbox, readProfiles } = setup({ bobOptedIn: false })

    await mailer.sendRequestReceived({ requesterId: 'u-alice', addresseeId: 'u-bob' })

    expect(outbox.rows).toHaveLength(0)
    expect(readProfiles).toEqual([])
  })

  it('spam de pedidos no mesmo dia gera um único e-mail por destinatário', async () => {
    const { mailer, outbox } = setup()

    await mailer.sendRequestReceived({ requesterId: 'u-alice', addresseeId: 'u-bob' })
    await mailer.sendRequestReceived({ requesterId: 'u-alice', addresseeId: 'u-bob' })
    await mailer.sendRequestAccepted({ requesterId: 'u-bob', accepterId: 'u-alice' })
    await mailer.sendRequestReceived({ requesterId: 'u-alice', addresseeId: 'u-bob' })

    expect(outbox.rows.filter((row) => row.userId === 'u-bob')).toHaveLength(1)
  })

  it('no dia seguinte (horário de Brasília) o destinatário pode receber de novo', async () => {
    const { mailer, outbox, setClock } = setup()
    setClock(new Date('2026-10-11T01:30:00Z')) // 22:30 de 10/10 em Brasília
    await mailer.sendRequestReceived({ requesterId: 'u-alice', addresseeId: 'u-bob' })
    setClock(new Date('2026-10-11T02:30:00Z')) // 23:30 ainda 10/10
    await mailer.sendRequestReceived({ requesterId: 'u-alice', addresseeId: 'u-bob' })
    expect(outbox.rows).toHaveLength(1)

    setClock(new Date('2026-10-11T03:30:00Z')) // 00:30 de 11/10 em Brasília
    await mailer.sendRequestReceived({ requesterId: 'u-alice', addresseeId: 'u-bob' })

    expect(outbox.rows).toHaveLength(2)
  })

  it('sem conseguir ler o perfil, o e-mail sai sem nível e percentual', async () => {
    const { mailer, outbox } = setup({ stats: null })

    await mailer.sendRequestReceived({ requesterId: 'u-alice', addresseeId: 'u-bob' })

    expect(outbox.rows[0].payload).toEqual({
      name: 'Bob',
      friendUsername: 'alice',
      unsubscribeUrl: 'https://api.test/email/unsubscribe?token=u-bob|social',
    })
  })
})
