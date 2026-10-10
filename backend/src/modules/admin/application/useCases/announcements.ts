import {
  InvalidAdminAnnouncementError,
  TradingHaltConflictError,
  TradingHaltNotFoundError,
} from '../../domain/errors'
import type { AnnouncementBroadcaster } from '../ports/announcementBroadcast'
import type {
  AdminAnnouncement,
  AnnouncementAdmin,
  AnnouncementChanges,
  AnnouncementInput,
  EndedAnnouncement,
} from '../ports/announcementAdmin'
import type { LiftTradingHaltUseCase } from './liftTradingHalt'
import type { PauseTradingUseCase } from './pauseTrading'
import type { RecordAdminActionUseCase } from './recordAdminAction'

export class ListAdminAnnouncementsUseCase {
  constructor(private readonly announcementAdmin: AnnouncementAdmin) {}

  execute(): Promise<AdminAnnouncement[]> {
    return this.announcementAdmin.list()
  }
}

// Só o que foi pedido, em snake_case, pro log de auditoria.
function changesPayload(
  changes: AnnouncementChanges & { notifyByEmail?: boolean },
): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  if (changes.title !== undefined) payload.title = changes.title
  if (changes.body !== undefined) payload.body = changes.body
  if (changes.severity !== undefined) payload.severity = changes.severity
  if (changes.dismissible !== undefined) payload.dismissible = changes.dismissible
  if (changes.notifyByEmail) payload.notify_by_email = true
  if (changes.startsAt !== undefined) payload.starts_at = changes.startsAt.toISOString()
  if (changes.endsAt !== undefined) payload.ends_at = changes.endsAt?.toISOString() ?? null
  return payload
}

// O comunicado já está no ar: falha ao iniciar o lote de e-mails só é logada, nunca derruba a
// criação (o banner do app já avisa).
async function startEmailsSafely(
  broadcaster: AnnouncementBroadcaster,
  announcement: AdminAnnouncement,
): Promise<void> {
  if (!announcement.notifyByEmail) return
  try {
    await broadcaster.start(announcement)
  } catch (err) {
    console.error('[announcements] falha ao iniciar o envio por e-mail', announcement.id, err)
  }
}

export class CreateAdminAnnouncementUseCase {
  constructor(
    private readonly announcementAdmin: AnnouncementAdmin,
    private readonly recordAdminAction: RecordAdminActionUseCase,
    private readonly broadcaster: AnnouncementBroadcaster,
  ) {}

  execute(adminId: string, input: AnnouncementInput): Promise<AdminAnnouncement> {
    return this.recordAdminAction.run(
      {
        adminId,
        action: 'announcement.create',
        targetType: 'announcement',
        payload: changesPayload(input),
      },
      async () => {
        const created = await this.announcementAdmin.create(adminId, input)
        await startEmailsSafely(this.broadcaster, created)
        return created
      },
      (created) => ({ targetId: created.id }),
    )
  }
}

export class UpdateAdminAnnouncementUseCase {
  constructor(
    private readonly announcementAdmin: AnnouncementAdmin,
    private readonly recordAdminAction: RecordAdminActionUseCase,
  ) {}

  execute(adminId: string, id: string, changes: AnnouncementChanges): Promise<AdminAnnouncement> {
    return this.recordAdminAction.run(
      {
        adminId,
        action: 'announcement.update',
        targetType: 'announcement',
        targetId: id,
        payload: changesPayload(changes),
      },
      () => this.announcementAdmin.update(id, changes),
    )
  }
}

export interface StartMaintenanceInput {
  title: string
  body: string
  startsAt?: Date
  endsAt: Date | null
  // Liga a pausa global de negociação junto com o aviso.
  pauseTrading: boolean
  // Avisa também por e-mail quem tem e-mail verificado (E9).
  notifyByEmail: boolean
}

// Modo de manutenção (N.20): abre um aviso crítico e, se pedido, a pausa global (N.9). A pausa
// é aberta primeiro, pelo mesmo caso de uso do painel de pausa (então tem a própria linha de
// auditoria `trading.halt`); se o aviso falhar depois, a pausa é levantada pra não deixar o
// mercado travado sem ninguém avisado.
export class StartMaintenanceUseCase {
  constructor(
    private readonly announcementAdmin: AnnouncementAdmin,
    private readonly pauseTrading: PauseTradingUseCase,
    private readonly liftTradingHalt: LiftTradingHaltUseCase,
    private readonly recordAdminAction: RecordAdminActionUseCase,
    private readonly broadcaster: AnnouncementBroadcaster,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(adminId: string, input: StartMaintenanceInput): Promise<AdminAnnouncement> {
    // A pausa vale já, então o aviso também: manutenção agendada com pausa imediata deixaria o
    // mercado travado antes de o aviso aparecer.
    if (input.pauseTrading && input.startsAt) {
      throw new InvalidAdminAnnouncementError(
        'com a pausa de negociação a manutenção começa agora: não informe o início',
      )
    }
    const startsAt = input.startsAt ?? this.now()
    return this.recordAdminAction.run(
      {
        adminId,
        action: 'maintenance.start',
        targetType: 'announcement',
        payload: {
          title: input.title,
          body: input.body,
          starts_at: startsAt.toISOString(),
          ends_at: input.endsAt?.toISOString() ?? null,
          pause_trading: input.pauseTrading,
          ...(input.notifyByEmail ? { notify_by_email: true } : {}),
        },
      },
      async () => {
        const halt = input.pauseTrading
          ? await this.pauseTrading.execute(adminId, {
              scope: 'global',
              reason: `Manutenção: ${input.title}`.slice(0, 200),
            })
          : null
        try {
          const created = await this.announcementAdmin.startMaintenance(adminId, {
            title: input.title,
            body: input.body,
            startsAt,
            endsAt: input.endsAt,
            linkedHaltId: halt?.id ?? null,
            notifyByEmail: input.notifyByEmail,
          })
          await startEmailsSafely(this.broadcaster, created)
          return created
        } catch (err) {
          if (halt) await this.liftBestEffort(adminId, halt.id)
          throw err
        }
      },
      (created) => ({ targetId: created.id }),
    )
  }

  private async liftBestEffort(adminId: string, haltId: string): Promise<void> {
    try {
      await this.liftTradingHalt.execute(adminId, haltId)
    } catch (err) {
      console.error('[maintenance] não foi possível levantar a pausa após falha', haltId, err)
    }
  }
}

export interface EndAnnouncementOutcome extends EndedAnnouncement {
  // A pausa de negociação ligada à manutenção foi levantada agora.
  haltLifted: boolean
}

// Encerra um comunicado (ou a manutenção). Se havia pausa ligada, ela é levantada junto; pausa
// que já tinha sido levantada à mão no painel de pausa não é erro.
export class EndAdminAnnouncementUseCase {
  constructor(
    private readonly announcementAdmin: AnnouncementAdmin,
    private readonly liftTradingHalt: LiftTradingHaltUseCase,
    private readonly recordAdminAction: RecordAdminActionUseCase,
  ) {}

  execute(adminId: string, id: string): Promise<EndAnnouncementOutcome> {
    return this.recordAdminAction.run(
      { adminId, action: 'announcement.end', targetType: 'announcement', targetId: id },
      async () => {
        const ended = await this.announcementAdmin.end(id)
        const haltId = ended.announcement.linkedHaltId
        return {
          ...ended,
          haltLifted: haltId ? await this.liftIfStillActive(adminId, haltId) : false,
        }
      },
      (result) => ({
        payload: {
          kind: result.announcement.kind,
          outcome: result.outcome,
          halt_lifted: result.haltLifted,
        },
      }),
    )
  }

  private async liftIfStillActive(adminId: string, haltId: string): Promise<boolean> {
    try {
      await this.liftTradingHalt.execute(adminId, haltId)
      return true
    } catch (err) {
      // 409 (já levantada) e 404 são o esperado quando alguém retomou à mão antes.
      if (err instanceof TradingHaltConflictError || err instanceof TradingHaltNotFoundError) {
        return false
      }
      throw err
    }
  }
}
