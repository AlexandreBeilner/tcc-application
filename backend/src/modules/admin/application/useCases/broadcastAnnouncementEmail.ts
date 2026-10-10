import type { AdminAnnouncement } from '../ports/announcementAdmin'
import type {
  AnnouncementBroadcaster,
  AnnouncementMailer,
  AnnouncementRecipients,
} from '../ports/announcementBroadcast'

export const BROADCAST_PAGE_SIZE = 200

export interface BroadcastResult {
  queued: number
}

// Enfileira o comunicado para cada destinatário elegível (E9). O envio de verdade é do worker do
// outbox; aqui só se decide quem recebe e quando. Cada e-mail ganha um `sendAt` espaçado em
// `spacingMs` (o intervalo que respeita `EMAIL_SEND_RPS`): o lote vira uma fila comprida de
// horários futuros, e como o worker lê por `next_attempt_at`, um e-mail de segurança enfileirado
// durante o lote (reset de senha) sai antes do que sobrou dele em vez de esperar o fim.
// Idempotente por (comunicado, usuário): reexecutar não duplica.
export class BroadcastAnnouncementEmailUseCase {
  constructor(
    private readonly recipients: AnnouncementRecipients,
    private readonly mailer: AnnouncementMailer,
    private readonly spacingMs: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(announcement: AdminAnnouncement): Promise<BroadcastResult> {
    const startedAt = this.now().getTime()
    let queued = 0
    let cursor: string | null = null
    for (;;) {
      const page = await this.recipients.listPage(cursor, BROADCAST_PAGE_SIZE)
      if (page.length === 0) break
      for (const recipient of page) {
        await this.mailer.send({
          recipient,
          announcement,
          sendAt: new Date(startedAt + queued * this.spacingMs),
        })
        queued += 1
      }
      cursor = page[page.length - 1].userId
      if (page.length < BROADCAST_PAGE_SIZE) break
    }
    return { queued }
  }
}

// Roda o lote em segundo plano: a resposta do painel não espera milhares de inserts. Falha no
// meio só é logada; como o envio é idempotente por destinatário, o lote pode ser refeito.
export function createBackgroundAnnouncementBroadcaster(
  broadcast: Pick<BroadcastAnnouncementEmailUseCase, 'execute'>,
): AnnouncementBroadcaster {
  return {
    async start(announcement) {
      void broadcast
        .execute(announcement)
        .then((result) => {
          console.log(`[announcements] ${result.queued} e-mails enfileirados`, announcement.id)
        })
        .catch((err) => {
          console.error('[announcements] falha no lote de e-mails', announcement.id, err)
        })
    },
  }
}
