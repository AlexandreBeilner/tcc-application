export type AnnouncementSeverity = 'info' | 'warning' | 'critical'
export type AnnouncementKind = 'notice' | 'maintenance'
export type AnnouncementStatus = 'scheduled' | 'active' | 'ended'

export interface AdminAnnouncement {
  id: string
  title: string
  body: string
  severity: AnnouncementSeverity
  kind: AnnouncementKind
  dismissible: boolean
  notifyByEmail: boolean
  startsAt: Date
  endsAt: Date | null
  // Pausa global aberta junto com a manutenção (levantada ao encerrá-la).
  linkedHaltId: string | null
  createdBy: string
  createdAt: Date
  status: AnnouncementStatus
}

export interface AnnouncementInput {
  title: string
  body: string
  severity: AnnouncementSeverity
  dismissible: boolean
  notifyByEmail: boolean
  startsAt: Date
  endsAt: Date | null
}

export interface AnnouncementChanges {
  title?: string
  body?: string
  severity?: AnnouncementSeverity
  dismissible?: boolean
  startsAt?: Date
  endsAt?: Date | null
}

export interface MaintenanceInput {
  title: string
  body: string
  startsAt: Date
  endsAt: Date | null
  linkedHaltId: string | null
  notifyByEmail: boolean
}

export interface EndedAnnouncement {
  announcement: AdminAnnouncement
  // 'cancelled': ainda estava agendado e foi removido.
  outcome: 'ended' | 'cancelled'
}

// Comunicados globais (N.20): as regras (janela, texto puro, uma manutenção por vez) vivem no
// módulo `announcements`; o painel só audita e liga a manutenção à pausa de negociação.
export interface AnnouncementAdmin {
  list(): Promise<AdminAnnouncement[]>
  create(adminId: string, input: AnnouncementInput): Promise<AdminAnnouncement>
  update(id: string, changes: AnnouncementChanges): Promise<AdminAnnouncement>
  end(id: string): Promise<EndedAnnouncement>
  startMaintenance(adminId: string, input: MaintenanceInput): Promise<AdminAnnouncement>
}
