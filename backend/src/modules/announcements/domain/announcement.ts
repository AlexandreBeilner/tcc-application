import { InvalidAnnouncementError } from './errors'

export const ANNOUNCEMENT_SEVERITIES = ['info', 'warning', 'critical'] as const
export type AnnouncementSeverity = (typeof ANNOUNCEMENT_SEVERITIES)[number]

// 'maintenance' é o aviso aberto pelo modo de manutenção (N.20): crítico, não dispensável,
// e pode carregar a pausa global que abriu junto.
export type AnnouncementKind = 'notice' | 'maintenance'

export const MAX_ANNOUNCEMENT_TITLE_LENGTH = 80
export const MAX_ANNOUNCEMENT_BODY_LENGTH = 280

export interface Announcement {
  id: string
  title: string
  body: string
  severity: AnnouncementSeverity
  kind: AnnouncementKind
  dismissible: boolean
  // Também enviado por e-mail na criação (EM.5.2). Não se edita depois: o e-mail já saiu.
  notifyByEmail: boolean
  startsAt: Date
  // Nulo = fica até alguém encerrar.
  endsAt: Date | null
  linkedHaltId: string | null
  createdBy: string
  createdAt: Date
}

export type AnnouncementStatus = 'scheduled' | 'active' | 'ended'

export interface AnnouncementDraft {
  title: string
  body: string
  severity: AnnouncementSeverity
  dismissible: boolean
  notifyByEmail: boolean
  startsAt: Date
  endsAt: Date | null
}

export interface AnnouncementPatch {
  title?: string
  body?: string
  severity?: AnnouncementSeverity
  dismissible?: boolean
  startsAt?: Date
  endsAt?: Date | null
}

// Janela semiaberta [início, fim): no instante do fim o comunicado já saiu do ar.
export function announcementStatus(
  announcement: Pick<Announcement, 'startsAt' | 'endsAt'>,
  now: Date,
): AnnouncementStatus {
  if (announcement.startsAt.getTime() > now.getTime()) return 'scheduled'
  if (announcement.endsAt && announcement.endsAt.getTime() <= now.getTime()) return 'ended'
  return 'active'
}

// O texto é puro: o app o renderiza como texto, nunca como HTML. Recusar `<` e `>` aqui
// impede que alguém cole markup achando que ele funciona (e que um cliente futuro, como o
// WebView, o interprete sem escape).
function cleanText(value: string, label: string, max: number): string {
  const text = value.trim()
  if (text.length === 0 || text.length > max) {
    throw new InvalidAnnouncementError(`${label} precisa ter de 1 a ${max} caracteres`)
  }
  if (/[<>]/.test(text)) {
    throw new InvalidAnnouncementError(`${label} é texto simples: não use < nem >`)
  }
  return text
}

function checkWindow(startsAt: Date, endsAt: Date | null): void {
  if (Number.isNaN(startsAt.getTime()) || (endsAt && Number.isNaN(endsAt.getTime()))) {
    throw new InvalidAnnouncementError('data inválida')
  }
  if (endsAt && endsAt.getTime() <= startsAt.getTime()) {
    throw new InvalidAnnouncementError('o fim precisa ser depois do início')
  }
}

export function validateAnnouncementDraft(draft: AnnouncementDraft): AnnouncementDraft {
  const result: AnnouncementDraft = {
    ...draft,
    title: cleanText(draft.title, 'o título', MAX_ANNOUNCEMENT_TITLE_LENGTH),
    body: cleanText(draft.body, 'o texto', MAX_ANNOUNCEMENT_BODY_LENGTH),
  }
  if (!ANNOUNCEMENT_SEVERITIES.includes(result.severity)) {
    throw new InvalidAnnouncementError('severidade fora da lista')
  }
  checkWindow(result.startsAt, result.endsAt)
  return result
}

// Aplica o patch sobre o estado atual e valida o estado final (uma edição só do fim é
// recusada se ele ficar antes do início existente).
export function applyAnnouncementPatch(
  current: Announcement,
  patch: AnnouncementPatch,
): AnnouncementDraft {
  return validateAnnouncementDraft({
    title: patch.title ?? current.title,
    body: patch.body ?? current.body,
    severity: patch.severity ?? current.severity,
    dismissible: patch.dismissible ?? current.dismissible,
    notifyByEmail: current.notifyByEmail,
    startsAt: patch.startsAt ?? current.startsAt,
    endsAt: patch.endsAt === undefined ? current.endsAt : patch.endsAt,
  })
}

// Mais grave primeiro; dentro da mesma severidade, o mais recente.
const SEVERITY_RANK: Record<AnnouncementSeverity, number> = { critical: 0, warning: 1, info: 2 }

export function compareForDisplay(a: Announcement, b: Announcement): number {
  const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
  if (bySeverity !== 0) return bySeverity
  return b.startsAt.getTime() - a.startsAt.getTime()
}
