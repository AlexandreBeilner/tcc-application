import { useState } from 'react'
import { Button } from '../../atoms/Button'
import { Select } from '../../atoms/Select'
import {
    BODY_MAX_LENGTH,
    EMPTY_ANNOUNCEMENT_FORM,
    formFromAnnouncement,
    SEVERITY_OPTIONS,
    STATUS_LABELS,
    TITLE_MAX_LENGTH,
    validateAnnouncementForm,
} from '../../../features/admin/announcementForm'
import type { AnnouncementFormValues } from '../../../features/admin/announcementForm'
import { formatDateTime } from '../../../features/admin/timeFormat'
import type { AdminAnnouncement, AnnouncementSeverity } from '../../../services/admin'
import type { AdminAnnouncementsPanelProps } from './types'
import styles from './index.module.css'

export type { AdminAnnouncementsPanelProps } from './types'

// Comunicados globais (N.20): formulário de criação/edição e a lista com o estado de cada um.
// O formulário se limpa quando a página remonta o painel (`key`) depois de gravar. Aviso de manutenção só se encerra (a edição é recusada pelo backend), então não oferece "Editar".
export function AdminAnnouncementsPanel({ announcements, saving, endingId, onSave, onEnd }: AdminAnnouncementsPanelProps) {
    const [values, setValues] = useState<AnnouncementFormValues>(EMPTY_ANNOUNCEMENT_FORM)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [touched, setTouched] = useState(false)

    const problem = validateAnnouncementForm(values)
    const set = <K extends keyof AnnouncementFormValues>(key: K, value: AnnouncementFormValues[K]) =>
        setValues((current) => ({ ...current, [key]: value }))

    function submit() {
        setTouched(true)
        if (problem) return
        onSave(values, editingId)
    }

    function startEditing(announcement: AdminAnnouncement) {
        setValues(formFromAnnouncement(announcement))
        setEditingId(announcement.id)
        setTouched(false)
    }

    function cancelEditing() {
        setValues(EMPTY_ANNOUNCEMENT_FORM)
        setEditingId(null)
        setTouched(false)
    }

    return (
        <div className={styles.wrapper}>
            <section className={styles.panel} aria-label={editingId ? 'Editar comunicado' : 'Novo comunicado'}>
                <h2 className={styles.sectionTitle}>{editingId ? 'Editar comunicado' : 'Novo comunicado'}</h2>
                <label className={styles.field}>
                    <span>Título (até {TITLE_MAX_LENGTH} caracteres)</span>
                    <input
                        className={styles.input}
                        value={values.title}
                        maxLength={TITLE_MAX_LENGTH}
                        placeholder="Ex: Evento extraordinário no mercado"
                        onChange={(event) => set('title', event.target.value)}
                    />
                </label>
                <label className={styles.field}>
                    <span>
                        Texto ({values.body.length}/{BODY_MAX_LENGTH})
                    </span>
                    <textarea
                        className={styles.textarea}
                        value={values.body}
                        maxLength={BODY_MAX_LENGTH}
                        rows={3}
                        placeholder="Ex: Vamos avançar 5 dias do mercado às 22h."
                        onChange={(event) => set('body', event.target.value)}
                    />
                </label>
                <div className={styles.row}>
                    <label className={styles.field}>
                        <span>Severidade</span>
                        <Select
                            aria-label="Severidade"
                            value={values.severity}
                            options={SEVERITY_OPTIONS}
                            onChange={(value) => {
                                set('severity', value as AnnouncementSeverity)
                                if (value !== 'critical') set('notifyByEmail', false)
                            }}
                        />
                    </label>
                    <label className={styles.field}>
                        <span>Início (vazio = agora)</span>
                        <input
                            className={styles.input}
                            type="datetime-local"
                            value={values.startsAt}
                            onChange={(event) => set('startsAt', event.target.value)}
                        />
                    </label>
                    <label className={styles.field}>
                        <span>Fim (vazio = até encerrar)</span>
                        <input
                            className={styles.input}
                            type="datetime-local"
                            value={values.endsAt}
                            onChange={(event) => set('endsAt', event.target.value)}
                        />
                    </label>
                </div>
                <label className={styles.check}>
                    <input type="checkbox" checked={values.dismissible} onChange={(event) => set('dismissible', event.target.checked)} />
                    <span>O usuário pode dispensar a faixa</span>
                </label>
                {!editingId && (
                    <label className={styles.check}>
                        <input
                            type="checkbox"
                            checked={values.notifyByEmail}
                            disabled={values.severity !== 'critical'}
                            onChange={(event) => set('notifyByEmail', event.target.checked)}
                        />
                        <span>
                            Avisar também por e-mail quem tem o e-mail confirmado (só comunicado crítico; o envio sai uma vez, na
                            publicação)
                        </span>
                    </label>
                )}
                {touched && problem && (
                    <p className={styles.error} role="alert">
                        {problem}
                    </p>
                )}
                <div className={styles.actions}>
                    <Button disabled={saving} onClick={submit}>
                        {editingId ? 'Salvar alterações' : 'Publicar comunicado'}
                    </Button>
                    {editingId && (
                        <Button variant="secondary" disabled={saving} onClick={cancelEditing}>
                            Cancelar edição
                        </Button>
                    )}
                </div>
            </section>

            <section className={styles.section} aria-label="Comunicados">
                <h2 className={styles.sectionTitle}>Comunicados</h2>
                {announcements.length === 0 && <p className={styles.empty}>Nenhum comunicado criado ainda.</p>}
                <ul className={styles.list}>
                    {announcements.map((announcement) => (
                        <li key={announcement.id} className={styles.item}>
                            <div className={styles.head}>
                                <span className={`${styles.badge} ${announcement.status === 'active' ? '' : styles.dashed}`}>
                                    {STATUS_LABELS[announcement.status]}
                                </span>
                                <strong className={styles.itemTitle}>{announcement.title}</strong>
                                {announcement.kind === 'maintenance' && <span className={styles.tag}>Manutenção</span>}
                            </div>
                            <p className={styles.body}>{announcement.body}</p>
                            <p className={styles.meta}>
                                De {formatDateTime(announcement.starts_at)}
                                {announcement.ends_at ? ` até ${formatDateTime(announcement.ends_at)}` : ', sem fim definido'}
                                {announcement.dismissible ? '' : ', não dispensável'}
                                {announcement.notify_by_email ? ', avisado por e-mail' : ''}
                                {announcement.linked_halt_id ? ', com pausa de negociação' : ''}
                            </p>
                            {announcement.status !== 'ended' && (
                                <div className={styles.itemActions}>
                                    {announcement.kind === 'notice' && (
                                        <button type="button" className={styles.link} onClick={() => startEditing(announcement)}>
                                            Editar
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        className={styles.link}
                                        disabled={endingId === announcement.id}
                                        onClick={() => onEnd(announcement)}
                                    >
                                        {announcement.status === 'scheduled' ? 'Cancelar' : 'Encerrar'}
                                    </button>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    )
}
