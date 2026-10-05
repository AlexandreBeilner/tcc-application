import { useState } from 'react'
import { CONTENT_FIELD_LABELS, diffContent, formatContentValue, REVISION_ACTION_LABELS } from '../../../features/admin/lessonDraft'
import { useLessonRevisionQuery } from '../../../features/admin/useAdminLessons'
import type { AdminLessonContent, LessonRevisionItem } from '../../../services/admin'
import { ConfirmDialog } from '../../molecules/ConfirmDialog'
import styles from './index.module.css'

interface LessonRevisionListProps {
    lessonId: string
    revisions: LessonRevisionItem[]
    // Conteúdo salvo agora, pra comparar com cada revisão.
    current: AdminLessonContent
    restoring: boolean
    onRestore: (revisionId: string) => void
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

function RevisionDiff({ lessonId, revisionId, current }: { lessonId: string; revisionId: string; current: AdminLessonContent }) {
    const query = useLessonRevisionQuery(lessonId, revisionId)

    if (query.isLoading) return <p className={styles.muted}>Carregando revisão…</p>
    if (query.isError || !query.data) return <p className={styles.error}>Não foi possível carregar esta revisão.</p>

    const changed = diffContent(current, query.data)
    if (changed.length === 0) return <p className={styles.muted}>Igual ao conteúdo atual.</p>

    return (
        <div className={styles.diff}>
            <p className={styles.muted}>Restaurar esta revisão mudaria {changed.length === 1 ? 'este campo' : 'estes campos'}:</p>
            <ul className={styles.diffList}>
                {changed.map((key) => (
                    <li key={key}>
                        <strong>{CONTENT_FIELD_LABELS[key]}</strong>
                        <div className={styles.valueLabel}>Na revisão</div>
                        <pre className={styles.value}>{formatContentValue(query.data[key])}</pre>
                        <div className={styles.valueLabel}>Atual</div>
                        <pre className={styles.value}>{formatContentValue(current[key])}</pre>
                    </li>
                ))}
            </ul>
        </div>
    )
}

// Histórico de revisões da lição (N.23), da mais recente à mais antiga: quem mudou, quando, e o que uma
// restauração mudaria. Restaurar nunca apaga nada: grava uma revisão nova no topo da lista.
export function LessonRevisionList({ lessonId, revisions, current, restoring, onRestore }: LessonRevisionListProps) {
    const [open, setOpen] = useState<string | null>(null)
    const [confirming, setConfirming] = useState<LessonRevisionItem | null>(null)

    if (revisions.length === 0) {
        return <p className={styles.muted}>Ainda sem edições. A primeira edição guarda a versão original aqui.</p>
    }

    return (
        <section className={styles.root} aria-label="Histórico de revisões">
            <ul className={styles.list}>
                {revisions.map((revision) => (
                    <li key={revision.id} className={styles.item}>
                        <div className={styles.row}>
                            <div>
                                <div className={styles.title}>{REVISION_ACTION_LABELS[revision.action]}</div>
                                <div className={styles.muted}>
                                    {dateFormatter.format(new Date(revision.created_at))}
                                    {revision.admin_username ? ` por ${revision.admin_username}` : ''}
                                </div>
                            </div>
                            <div className={styles.actions}>
                                <button
                                    type="button"
                                    className={styles.link}
                                    aria-expanded={open === revision.id}
                                    onClick={() => setOpen(open === revision.id ? null : revision.id)}
                                >
                                    {open === revision.id ? 'Ocultar' : 'Comparar'}
                                </button>
                                <button type="button" className={styles.link} disabled={restoring} onClick={() => setConfirming(revision)}>
                                    Restaurar
                                </button>
                            </div>
                        </div>
                        {open === revision.id && <RevisionDiff lessonId={lessonId} revisionId={revision.id} current={current} />}
                    </li>
                ))}
            </ul>

            {confirming && (
                <ConfirmDialog
                    title="Restaurar esta revisão?"
                    confirmLabel="Restaurar"
                    pendingLabel="Restaurando…"
                    pending={restoring}
                    onConfirm={() => {
                        onRestore(confirming.id)
                        setConfirming(null)
                    }}
                    onCancel={() => setConfirming(null)}
                >
                    <p>O conteúdo da lição volta ao desta revisão e uma nova entrada é gravada no histórico. Nada é apagado.</p>
                </ConfirmDialog>
            )}
        </section>
    )
}
