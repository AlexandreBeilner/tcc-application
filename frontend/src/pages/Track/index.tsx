import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLessonsQuery } from '../../features/lessons/useLessonsQuery'
import { findActiveTrackNumber, groupLessonsByTrack } from '../../features/lessons/trackGroups'
import { useProgressionQuery } from '../../features/portfolio/useProgressionQuery'
import { useStreakQuery } from '../../features/portfolio/useStreakQuery'
import { LessonNode } from '../../components/organisms/LessonNode'
import { TrackChart } from '../../components/organisms/TrackChart'
import { ProgressionSummary } from '../../components/organisms/ProgressionSummary'
import { ResumeLessonCard } from '../../components/organisms/ResumeLessonCard'
import type { Lesson } from '../../services/lessons'
import styles from './index.module.css'

// Tela 3.1 (tarefa 6.4) — redesenhada em `.claude/identidade-visual-padroes.md`
// (mockup vivo linkado lá): trilhas com 2+ lições viram um gráfico de ativo
// subindo (`TrackChart`); trilhas de 1 lição continuam como linha simples
// (`LessonNode`), caso do teaser "Renda Fixa" hoje. `GET /lessons` já
// devolve `status`/`sortOrder` calculados por usuário
// (`.docs/backend/lessons.md`), então esta tela só agrupa por trilha e
// renderiza — nenhuma regra de bloqueio é recalculada no cliente.
export function Track() {
    const navigate = useNavigate()
    const lessonsQuery = useLessonsQuery()
    const progressionQuery = useProgressionQuery()
    const streakQuery = useStreakQuery()
    const [expandedHintId, setExpandedHintId] = useState<string | null>(null)

    const lessons = lessonsQuery.data?.lessons ?? []
    const groups = groupLessonsByTrack(lessons)
    const activeTrackNumber = findActiveTrackNumber(groups)
    const completedCount = lessons.filter((lesson) => lesson.status === 'completed').length
    const allCompleted = lessons.length > 0 && completedCount === lessons.length

    function handleLessonClick(lessonId: string, status: Lesson['status']) {
        if (status === 'locked') {
            setExpandedHintId((current) => (current === lessonId ? null : lessonId))
            return
        }

        navigate(`/trilha/${lessonId}`)
    }

    return (
        <main className={styles.page}>
            <div className={styles.layout}>
                <div className={styles.main}>
                    <header className={styles.header}>
                        <h1 className={styles.title}>Trilha</h1>
                        {lessons.length > 0 && (
                            <span className={styles.progress}>
                                {completedCount} de {lessons.length} lições concluídas
                            </span>
                        )}
                    </header>

                    {lessonsQuery.isError && (
                        <p className={styles.error} role="alert">
                            Não foi possível carregar a trilha agora. Tente novamente em instantes.
                        </p>
                    )}

                    {!lessonsQuery.data && !lessonsQuery.isError && <p className={styles.loading}>Carregando trilha…</p>}

                    {allCompleted && (
                        <p className={styles.unlockedBanner}>
                            <strong>Mundo aberto liberado</strong> — você concluiu todas as lições disponíveis até aqui.
                        </p>
                    )}

                    {groups.map((group) => (
                        <details key={group.trackNumber} className={styles.track} open={group.trackNumber === activeTrackNumber}>
                            <summary className={styles.trackSummary}>
                                <span>{group.trackName}</span>
                                <span className={styles.trackCount}>
                                    {group.lessons.filter((lesson) => lesson.status === 'completed').length}/{group.lessons.length}
                                </span>
                            </summary>

                            {group.lessons.length >= 2 ? (
                                <TrackChart
                                    lessons={group.lessons}
                                    expandedHintId={expandedHintId}
                                    onNodeClick={(lesson) => handleLessonClick(lesson.id, lesson.status)}
                                />
                            ) : (
                                <div className={styles.nodes}>
                                    {group.lessons.map((lesson) => (
                                        <div key={lesson.id}>
                                            <LessonNode lesson={lesson} onClick={() => handleLessonClick(lesson.id, lesson.status)} />
                                            {expandedHintId === lesson.id && (
                                                <p className={styles.hint}>Conclua a lição anterior pra desbloquear.</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </details>
                    ))}
                </div>

                <aside className={styles.sidebar}>
                    {progressionQuery.data && streakQuery.data && (
                        <ProgressionSummary progression={progressionQuery.data} streak={streakQuery.data} />
                    )}
                    {lessons.length > 0 && <ResumeLessonCard lessons={lessons} />}
                </aside>
            </div>
        </main>
    )
}
