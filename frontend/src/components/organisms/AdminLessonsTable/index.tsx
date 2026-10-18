import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
    describeLessonError,
    formatDuration,
    formatRate,
    groupLessonsByTrack,
    MICRO_DECISION_TYPE_LABELS,
    worstAbandonStep,
} from '../../../features/admin/lessonCatalog'
import { useAdminLessonsQuery, useSetLessonPublishedMutation } from '../../../features/admin/useAdminLessons'
import type { AdminLesson } from '../../../services/admin'
import { ConfirmDialog } from '../../molecules/ConfirmDialog'
import styles from './index.module.css'

function typeLabel(lesson: AdminLesson): string {
    const base = MICRO_DECISION_TYPE_LABELS[lesson.micro_decision_type]
    return lesson.has_bet ? `${base} com aposta` : base
}

function completedLabel(lesson: AdminLesson): string {
    const { completed, completion_rate } = lesson.funnel
    return completion_rate === null ? String(completed) : `${completed} (${formatRate(completion_rate)})`
}

function abandonLabel(lesson: AdminLesson): string {
    const worst = worstAbandonStep(lesson.funnel)
    return worst ? `${worst.label} (${worst.count} de ${lesson.funnel.abandoned})` : 'ninguém'
}

// Lições da trilha com o funil de cada uma (N.18), agrupadas por trilha: quantos iniciaram e concluíram,
// tempo típico (mediana, que não é puxada por quem pausa e volta no dia seguinte), acerto da aposta e o
// passo onde mais gente para. Publicar ou despublicar tira a lição da trilha de todos sem apagar progresso;
// publicar de volta dispensa quem já passou daquele ponto, então ninguém fica travado. Tabela no tablet e
// no desktop, cartões no mobile.
export function AdminLessonsTable() {
    const lessonsQuery = useAdminLessonsQuery()
    const setPublished = useSetLessonPublishedMutation()
    const [confirming, setConfirming] = useState<AdminLesson | null>(null)
    const [notice, setNotice] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const lessons = lessonsQuery.data

    function run(lesson: AdminLesson, published: boolean) {
        setPublished.mutate(
            { id: lesson.id, published },
            {
                onSuccess: (result) => {
                    setError(null)
                    setNotice(
                        published
                            ? `Lição ${lesson.code} publicada.${result.waived_users > 0 ? ` ${result.waived_users} usuário(s) que já tinham passado desse ponto receberam a lição como opcional.` : ''}`
                            : `Lição ${lesson.code} despublicada. Ninguém perdeu progresso.`,
                    )
                },
                onError: (err) => {
                    setNotice(null)
                    setError(describeLessonError(err))
                },
                onSettled: () => setConfirming(null),
            },
        )
    }

    const status = (lesson: AdminLesson) => (
        <span className={`${styles.badge} ${lesson.published ? '' : styles.dashed}`}>
            {lesson.published ? 'Publicada' : 'Despublicada'}
        </span>
    )
    const action = (lesson: AdminLesson) => (
        <div className={styles.rowActions}>
            <Link to={`/admin/conteudo/${lesson.id}`} className={styles.link}>
                Editar
            </Link>
            <Link to={`/admin/conteudo/${lesson.id}/funil`} className={styles.link}>
                Funil
            </Link>
            {lesson.published ? (
                <button type="button" className={styles.link} disabled={setPublished.isPending} onClick={() => setConfirming(lesson)}>
                    Despublicar
                </button>
            ) : (
                <button type="button" className={styles.link} disabled={setPublished.isPending} onClick={() => run(lesson, true)}>
                    Publicar
                </button>
            )}
        </div>
    )

    return (
        <section className={styles.root} aria-label="Lições da trilha">
            <div className={styles.toolbar}>
                <Link to="/admin/conteudo/nova" className={styles.newLink}>
                    Nova lição
                </Link>
            </div>

            <p className={styles.intro}>
                Os números vêm do progresso real dos usuários. O tempo típico inclui pausas e usa a mediana. Despublicar uma lição a tira da
                trilha de todos sem apagar progresso e sem travar ninguém.
            </p>

            {notice && (
                <p className={styles.notice} role="status">
                    {notice}
                </p>
            )}
            {error && (
                <p className={styles.error} role="alert">
                    {error}
                </p>
            )}
            {lessonsQuery.isLoading && <p className={styles.muted}>Carregando lições…</p>}
            {lessonsQuery.isError && (
                <p className={styles.error} role="alert">
                    Não foi possível carregar as lições agora.
                </p>
            )}
            {lessons && lessons.length === 0 && <p className={styles.muted}>Nenhuma lição cadastrada.</p>}

            {lessons &&
                groupLessonsByTrack(lessons).map((track) => (
                    <div key={track.trackNumber} className={styles.track}>
                        <h2 className={styles.trackTitle}>{track.trackName}</h2>

                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    {[
                                        'Lição',
                                        'Tipo',
                                        'Pré-requisito',
                                        'Iniciaram',
                                        'Concluíram',
                                        'Tempo típico',
                                        'Acerto da aposta',
                                        'Para no passo',
                                        'Status',
                                        '',
                                    ].map((header, index) => (
                                        <th key={index} className={styles.th}>
                                            {header}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {track.lessons.map((lesson) => (
                                    <tr key={lesson.id} className={styles.tr}>
                                        <td className={styles.td}>
                                            <div className={styles.name}>
                                                {lesson.code} · {lesson.title}
                                            </div>
                                        </td>
                                        <td className={styles.td}>{typeLabel(lesson)}</td>
                                        <td className={styles.td}>{lesson.prerequisite_code ?? 'nenhum'}</td>
                                        <td className={styles.td}>{lesson.funnel.started}</td>
                                        <td className={styles.td}>{completedLabel(lesson)}</td>
                                        <td className={styles.td}>{formatDuration(lesson.funnel.median_seconds_to_complete)}</td>
                                        <td className={styles.td}>
                                            {lesson.has_bet ? formatRate(lesson.funnel.bet_accuracy) : 'sem aposta'}
                                        </td>
                                        <td className={styles.td}>{abandonLabel(lesson)}</td>
                                        <td className={styles.td}>{status(lesson)}</td>
                                        <td className={styles.td}>{action(lesson)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <ul className={styles.cards}>
                            {track.lessons.map((lesson) => (
                                <li key={lesson.id} className={styles.card}>
                                    <div className={styles.name}>
                                        {lesson.code} · {lesson.title}
                                    </div>
                                    <div className={styles.sub}>{typeLabel(lesson)}</div>
                                    <div className={styles.cardRow}>
                                        <span className={styles.cardLabel}>Pré-requisito</span>
                                        <span>{lesson.prerequisite_code ?? 'nenhum'}</span>
                                    </div>
                                    <div className={styles.cardRow}>
                                        <span className={styles.cardLabel}>Iniciaram</span>
                                        <span>{lesson.funnel.started}</span>
                                    </div>
                                    <div className={styles.cardRow}>
                                        <span className={styles.cardLabel}>Concluíram</span>
                                        <span>{completedLabel(lesson)}</span>
                                    </div>
                                    <div className={styles.cardRow}>
                                        <span className={styles.cardLabel}>Tempo típico</span>
                                        <span>{formatDuration(lesson.funnel.median_seconds_to_complete)}</span>
                                    </div>
                                    <div className={styles.cardRow}>
                                        <span className={styles.cardLabel}>Acerto da aposta</span>
                                        <span>{lesson.has_bet ? formatRate(lesson.funnel.bet_accuracy) : 'sem aposta'}</span>
                                    </div>
                                    <div className={styles.cardRow}>
                                        <span className={styles.cardLabel}>Para no passo</span>
                                        <span>{abandonLabel(lesson)}</span>
                                    </div>
                                    <div className={styles.cardRow}>
                                        <span className={styles.cardLabel}>Status</span>
                                        {status(lesson)}
                                    </div>
                                    {action(lesson)}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}

            {confirming && (
                <ConfirmDialog
                    title="Despublicar esta lição?"
                    confirmLabel="Despublicar"
                    pendingLabel="Despublicando…"
                    pending={setPublished.isPending}
                    onConfirm={() => run(confirming, false)}
                    onCancel={() => setConfirming(null)}
                >
                    <p>
                        A lição <strong>{confirming.code}</strong> sai da trilha de todos os usuários.
                    </p>
                    <p>
                        Ninguém perde progresso, ninguém fica travado e ninguém pula uma lição. Quem a tinha concluído mantém o XP. Dá para
                        publicar de novo a qualquer momento.
                    </p>
                </ConfirmDialog>
            )}
        </section>
    )
}
