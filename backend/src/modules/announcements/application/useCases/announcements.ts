import {
  announcementStatus,
  applyAnnouncementPatch,
  compareForDisplay,
  validateAnnouncementDraft,
  type Announcement,
  type AnnouncementDraft,
  type AnnouncementPatch,
  type AnnouncementStatus,
} from '../../domain/announcement'
import { AnnouncementConflictError, AnnouncementNotFoundError } from '../../domain/errors'
import type { AnnouncementRepository } from '../ports/announcementRepository'

export type Clock = () => Date

export interface AnnouncementEntry extends Announcement {
  status: AnnouncementStatus
}

const ADMIN_LIST_LIMIT = 100

// O que o app do usuário mostra: só os que estão no ar agora, o mais grave primeiro.
export class ListActiveAnnouncementsUseCase {
  constructor(
    private readonly repository: AnnouncementRepository,
    private readonly now: Clock = () => new Date(),
  ) {}

  async execute(): Promise<Announcement[]> {
    const active = await this.repository.listActive(this.now())
    return active.sort(compareForDisplay)
  }
}

export class ListAnnouncementsUseCase {
  constructor(
    private readonly repository: AnnouncementRepository,
    private readonly now: Clock = () => new Date(),
  ) {}

  async execute(): Promise<AnnouncementEntry[]> {
    const now = this.now()
    const all = await this.repository.listAll(ADMIN_LIST_LIMIT)
    return all.map((announcement) => ({
      ...announcement,
      status: announcementStatus(announcement, now),
    }))
  }
}

export interface CreateAnnouncementInput {
  draft: AnnouncementDraft
  createdBy: string
  // Aviso aberto pelo modo de manutenção: crítico, não dispensável, no máximo um em aberto.
  maintenance?: { linkedHaltId: string | null }
}

export class CreateAnnouncementUseCase {
  constructor(
    private readonly repository: AnnouncementRepository,
    private readonly now: Clock = () => new Date(),
  ) {}

  async execute(input: CreateAnnouncementInput): Promise<Announcement> {
    if (!input.maintenance) {
      const draft = validateAnnouncementDraft(input.draft)
      return this.repository.create({ ...draft, kind: 'notice', createdBy: input.createdBy })
    }
    const draft = validateAnnouncementDraft({
      ...input.draft,
      severity: 'critical',
      dismissible: false,
    })
    if (await this.repository.findOpenMaintenance(this.now())) {
      throw new AnnouncementConflictError('já existe uma manutenção em andamento ou agendada')
    }
    return this.repository.create({
      ...draft,
      kind: 'maintenance',
      linkedHaltId: input.maintenance.linkedHaltId,
      createdBy: input.createdBy,
    })
  }
}

export class UpdateAnnouncementUseCase {
  constructor(
    private readonly repository: AnnouncementRepository,
    private readonly now: Clock = () => new Date(),
  ) {}

  async execute(id: string, patch: AnnouncementPatch): Promise<Announcement> {
    const current = await this.repository.findById(id)
    if (!current) throw new AnnouncementNotFoundError('comunicado não encontrado')
    if (current.kind === 'maintenance') {
      throw new AnnouncementConflictError(
        'o aviso de manutenção não se edita: encerre e abra outro',
      )
    }
    if (announcementStatus(current, this.now()) === 'ended') {
      throw new AnnouncementConflictError('o comunicado já terminou')
    }
    const updated = await this.repository.update(id, applyAnnouncementPatch(current, patch))
    if (!updated) throw new AnnouncementNotFoundError('comunicado não encontrado')
    return updated
  }
}

export interface EndAnnouncementResult {
  // O estado antes de encerrar (o painel usa o `linkedHaltId` pra levantar a pausa).
  announcement: Announcement
  // 'ended': saiu do ar agora. 'cancelled': ainda estava agendado e foi removido.
  outcome: 'ended' | 'cancelled'
}

export class EndAnnouncementUseCase {
  constructor(
    private readonly repository: AnnouncementRepository,
    private readonly now: Clock = () => new Date(),
  ) {}

  async execute(id: string): Promise<EndAnnouncementResult> {
    const announcement = await this.repository.findById(id)
    if (!announcement) throw new AnnouncementNotFoundError('comunicado não encontrado')
    const now = this.now()
    const status = announcementStatus(announcement, now)
    if (status === 'ended') throw new AnnouncementConflictError('o comunicado já terminou')
    if (status === 'scheduled') {
      await this.repository.remove(id)
      return { announcement, outcome: 'cancelled' }
    }
    await this.repository.setEnd(id, now)
    return { announcement, outcome: 'ended' }
  }
}
