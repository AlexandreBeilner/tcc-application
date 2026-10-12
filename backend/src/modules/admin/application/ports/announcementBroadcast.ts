import type { AdminAnnouncement } from './announcementAdmin'

export interface AnnouncementRecipient {
  userId: string
  email: string
  name: string
}

// Quem recebe o comunicado por e-mail: contas ativas com e-mail verificado, nunca anonimizadas.
// Paginação por cursor (`afterUserId`) para o lote não depender de carregar todo mundo em memória.
export interface AnnouncementRecipients {
  listPage(afterUserId: string | null, limit: number): Promise<AnnouncementRecipient[]>
}

export interface AnnouncementEmail {
  recipient: AnnouncementRecipient
  announcement: AdminAnnouncement
  // Instante em que o e-mail pode sair: o lote é espaçado para respeitar o limite do provedor.
  sendAt: Date
}

export interface AnnouncementMailer {
  send(email: AnnouncementEmail): Promise<void>
}

// Dispara o envio do comunicado. Devolve assim que o lote foi aceito: o enfileiramento de todos
// os destinatários continua em segundo plano e não segura a resposta do painel.
export interface AnnouncementBroadcaster {
  start(announcement: AdminAnnouncement): Promise<void>
}
