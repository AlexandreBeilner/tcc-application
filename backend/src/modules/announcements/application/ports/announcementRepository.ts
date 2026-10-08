import type { Announcement, AnnouncementDraft, AnnouncementKind } from '../../domain/announcement'

export interface NewAnnouncement extends AnnouncementDraft {
  kind: AnnouncementKind
  linkedHaltId?: string | null
  createdBy: string
}

export interface AnnouncementRepository {
  // Os que estão no ar em `now`, sem ordenação garantida.
  listActive(now: Date): Promise<Announcement[]>
  // Todos, do mais recente pro mais antigo, limitados (o painel é um histórico curto).
  listAll(limit: number): Promise<Announcement[]>
  findById(id: string): Promise<Announcement | null>
  // O aviso de manutenção que ainda não terminou em `now` (no ar ou agendado), se houver.
  findOpenMaintenance(now: Date): Promise<Announcement | null>
  create(announcement: NewAnnouncement): Promise<Announcement>
  update(id: string, draft: AnnouncementDraft): Promise<Announcement | null>
  // Fixa o fim em `endsAt` (encerra um aviso no ar).
  setEnd(id: string, endsAt: Date): Promise<Announcement | null>
  // Remove um aviso que nunca chegou a ir ao ar.
  remove(id: string): Promise<void>
}
