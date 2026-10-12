import { ApiError } from '../../../services/client'
import type { AdminAnnouncement, AnnouncementSeverity, AnnouncementStatus } from '../../../services/admin'

export const TITLE_MAX_LENGTH = 80
export const BODY_MAX_LENGTH = 280

export const SEVERITY_OPTIONS: Array<{ value: AnnouncementSeverity; label: string }> = [
    { value: 'info', label: 'Informativo' },
    { value: 'warning', label: 'Atenção' },
    { value: 'critical', label: 'Crítico' },
]

export const STATUS_LABELS: Record<AnnouncementStatus, string> = {
    scheduled: 'Agendado',
    active: 'No ar',
    ended: 'Encerrado',
}

// O texto é puro: o backend recusa `<` e `>`. Barrar aqui evita a ida e volta.
export function hasMarkup(text: string): boolean {
    return /[<>]/.test(text)
}

// `datetime-local` entrega "AAAA-MM-DDTHH:mm" no fuso do navegador; o backend quer ISO com fuso.
export function localInputToIso(value: string): string | undefined {
    if (value.trim() === '') return undefined
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

export function isoToLocalInput(iso: string | null): string {
    if (!iso) return ''
    const date = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export interface AnnouncementFormValues {
    title: string
    body: string
    severity: AnnouncementSeverity
    dismissible: boolean
    // Só na criação e só para crítico: o e-mail sai uma vez, na publicação.
    notifyByEmail: boolean
    startsAt: string
    endsAt: string
}

export const EMPTY_ANNOUNCEMENT_FORM: AnnouncementFormValues = {
    title: '',
    body: '',
    severity: 'info',
    dismissible: true,
    notifyByEmail: false,
    startsAt: '',
    endsAt: '',
}

export function formFromAnnouncement(announcement: AdminAnnouncement): AnnouncementFormValues {
    return {
        title: announcement.title,
        body: announcement.body,
        severity: announcement.severity,
        dismissible: announcement.dismissible,
        notifyByEmail: announcement.notify_by_email,
        startsAt: isoToLocalInput(announcement.starts_at),
        endsAt: isoToLocalInput(announcement.ends_at),
    }
}

// Primeiro problema que impede o envio, em português, ou `null` se está pronto.
export function validateAnnouncementForm(values: AnnouncementFormValues): string | null {
    const title = values.title.trim()
    const body = values.body.trim()
    if (title.length === 0) return 'Escreva o título.'
    if (title.length > TITLE_MAX_LENGTH) return `O título passa de ${TITLE_MAX_LENGTH} caracteres.`
    if (body.length === 0) return 'Escreva o texto.'
    if (body.length > BODY_MAX_LENGTH) return `O texto passa de ${BODY_MAX_LENGTH} caracteres.`
    if (hasMarkup(title) || hasMarkup(body)) return 'O texto é simples: não use os sinais < e >.'
    if (values.notifyByEmail && values.severity !== 'critical') return 'Só comunicado crítico pode ir também por e-mail.'
    const starts = localInputToIso(values.startsAt)
    const ends = localInputToIso(values.endsAt)
    if (starts && ends && new Date(ends).getTime() <= new Date(starts).getTime()) {
        return 'O fim precisa ser depois do início.'
    }
    return null
}

export function describeAnnouncementError(err: unknown): string {
    if (err instanceof ApiError) {
        if (err.status === 409)
            return 'O estado desse comunicado mudou (já terminou, é manutenção ou já há uma manutenção em aberto). A lista foi atualizada.'
        if (err.status === 404) return 'Esse comunicado não existe mais.'
        if (err.status === 422 || err.status === 400) return 'O servidor recusou o comunicado: confira o texto e as datas.'
    }
    return 'Não foi possível concluir agora. Confira a lista e a auditoria antes de tentar de novo.'
}
