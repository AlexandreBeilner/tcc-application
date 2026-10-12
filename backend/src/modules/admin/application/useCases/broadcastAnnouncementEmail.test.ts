import { describe, expect, it } from 'vitest'
import type { AdminAnnouncement } from '../ports/announcementAdmin'
import type {
  AnnouncementEmail,
  AnnouncementRecipient,
  AnnouncementRecipients,
} from '../ports/announcementBroadcast'
import {
  BROADCAST_PAGE_SIZE,
  BroadcastAnnouncementEmailUseCase,
  createBackgroundAnnouncementBroadcaster,
} from './broadcastAnnouncementEmail'

const NOW = new Date('2026-10-10T12:00:00Z')

const announcement: AdminAnnouncement = {
  id: 'an-1',
  title: 'Manutenção',
  body: 'Voltamos logo.',
  severity: 'critical',
  kind: 'maintenance',
  dismissible: false,
  notifyByEmail: true,
  startsAt: NOW,
  endsAt: null,
  linkedHaltId: null,
  createdBy: 'admin',
  createdAt: NOW,
  status: 'active',
}

function recipientsOf(count: number): AnnouncementRecipient[] {
  return Array.from({ length: count }, (_, i) => ({
    userId: `u${String(i).padStart(6, '0')}`,
    email: `user${i}@exemplo.com`,
    name: `Usuário ${i}`,
  }))
}

// Diretório em memória com a mesma paginação por cursor do adapter real.
function fakeRecipients(all: AnnouncementRecipient[]): AnnouncementRecipients & { pages: number } {
  const fake = {
    pages: 0,
    async listPage(afterUserId: string | null, limit: number) {
      fake.pages += 1
      return all.filter((r) => afterUserId === null || r.userId > afterUserId).slice(0, limit)
    },
  }
  return fake
}

function build(count: number, spacingMs = 500) {
  const sent: AnnouncementEmail[] = []
  const recipients = fakeRecipients(recipientsOf(count))
  const useCase = new BroadcastAnnouncementEmailUseCase(
    recipients,
    {
      async send(email) {
        sent.push(email)
      },
    },
    spacingMs,
    () => NOW,
  )
  return { useCase, sent, recipients }
}

describe('BroadcastAnnouncementEmailUseCase', () => {
  it('espaça os envios no ritmo do provedor, para não estourar a cota', async () => {
    const { useCase, sent } = build(4, 500)

    const result = await useCase.execute(announcement)

    expect(result).toEqual({ queued: 4 })
    expect(sent.map((e) => e.sendAt.getTime() - NOW.getTime())).toEqual([0, 500, 1000, 1500])
  })

  it('percorre todas as páginas sem repetir nem pular ninguém (mais de uma página)', async () => {
    const total = BROADCAST_PAGE_SIZE * 2 + 37
    const { useCase, sent, recipients } = build(total)

    const result = await useCase.execute(announcement)

    expect(result.queued).toBe(total)
    expect(new Set(sent.map((e) => e.recipient.userId)).size).toBe(total)
    expect(recipients.pages).toBe(3)
  })

  it('lote com exatamente uma página cheia termina na página vazia seguinte', async () => {
    const { useCase, sent } = build(BROADCAST_PAGE_SIZE)

    await useCase.execute(announcement)

    expect(sent).toHaveLength(BROADCAST_PAGE_SIZE)
  })

  it('sem destinatário elegível não enfileira nada', async () => {
    const { useCase, sent } = build(0)

    expect(await useCase.execute(announcement)).toEqual({ queued: 0 })
    expect(sent).toEqual([])
  })

  it('o último e-mail do lote sai só depois de N x espaçamento: um e-mail de segurança novo passa na frente', async () => {
    const { useCase, sent } = build(1000, 500)

    await useCase.execute(announcement)

    const last = sent.at(-1)!.sendAt.getTime() - NOW.getTime()
    expect(last).toBe(999 * 500)
    // Um reset enfileirado "agora" tem horário 0, antes de quase todo o lote.
    expect(sent.filter((e) => e.sendAt.getTime() > NOW.getTime())).toHaveLength(999)
  })
})

describe('createBackgroundAnnouncementBroadcaster', () => {
  it('devolve na hora, sem esperar o lote terminar', async () => {
    let finish: () => void = () => {}
    const slow = new Promise<{ queued: number }>((resolve) => {
      finish = () => resolve({ queued: 1 })
    })
    const broadcaster = createBackgroundAnnouncementBroadcaster({ execute: () => slow })

    await broadcaster.start(announcement)

    finish()
  })

  it('falha no meio do lote é só logada, nunca vira exceção para o painel', async () => {
    const broadcaster = createBackgroundAnnouncementBroadcaster({
      execute: async () => {
        throw new Error('banco caiu')
      },
    })

    await expect(broadcaster.start(announcement)).resolves.toBeUndefined()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
})
