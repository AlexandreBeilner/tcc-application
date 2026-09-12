import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLessonsQuery } from '../../features/lessons/useLessonsQuery'
import { groupLessonsByTrack, trackStatusFor } from '../../features/lessons/trackGroups'
import type { TrackGroup, TrackStatus } from '../../features/lessons/trackGroups'
import { nextUnlockFor } from '../../features/lessons/nextUnlockFor'
import { computeTrackHubSparkline, TRACK_HUB_SPARKLINE_HEIGHT, TRACK_HUB_SPARKLINE_WIDTH } from '../../features/lessons/trackHubSparkline'
import { useProgressionQuery } from '../../features/portfolio/useProgressionQuery'
import { useStreakQuery } from '../../features/portfolio/useStreakQuery'
import { ProgressionSummary } from '../../components/organisms/ProgressionSummary'
import { ResumeLessonCard } from '../../components/organisms/ResumeLessonCard'
import { Locked } from '../../components/atoms/Locked'
import { TRACKS } from '../../utils/tracks'
import styles from './index.module.css'

const STATUS_LABEL: Record<TrackStatus, string> = {
    completed: 'Concluída',
    active: 'Em andamento',
    locked: 'Bloqueada',
}

// Tela 3.1 redesenhada (backlog engajamento O.1, mockup vivo em
// `.claude/backlog-engajamento-gamificacao.md` Fase O/O.0) — troca o
// acordeão de 4 `<details>` com `TrackChart`/`LessonNode` embutidos por uma
// grade de cards de trilha, no espírito de uma watchlist (uma trilha = um
// "ativo"). `TrackChart`/`LessonNode` ficam sem consumidor nesta tela a
// partir de agora, mas a retirada de verdade (deletar os componentes) só
// acontece na O.4, depois que a O.3 (mapa vertical) já existir de verdade.
export function TrilhasHub() {
    const navigate = useNavigate()
    const lessonsQuery = useLessonsQuery()
    const progressionQuery = useProgressionQuery()
    const streakQuery = useStreakQuery()

    const lessons = lessonsQuery.data?.lessons ?? []
    const groups = groupLessonsByTrack(lessons)
    const completedCount = lessons.filter((lesson) => lesson.status === 'completed').length
    const nextUnlock = nextUnlockFor(lessons)

    // "Bloqueio é convite" (Fase J/K): mesmo uma trilha 100% bloqueada
    // navega pro mapa dela, que mostra os nós travados em vez de negar a
    // entrada. A tela em `/trilha/mapa/:trackNumber` ainda não existe (nasce
    // na O.3) — a navegação já fica pronta aqui, mesmo padrão de outras
    // tarefas desta fase que constroem uma peça de cada vez (ex: O.2).
    function handleTrackClick(trackNumber: number) {
        navigate(`/trilha/mapa/${trackNumber}`)
    }

    return (
        <main className={styles.page}>
            <div className={styles.layout}>
                <div className={styles.main}>
                    <header className={styles.header}>
                        <h1 className={styles.title}>Trilhas</h1>
                        {lessons.length > 0 && (
                            <span className={styles.progress}>
                                {completedCount} de {lessons.length} lições concluídas no total
                            </span>
                        )}
                    </header>

                    {lessonsQuery.isError && (
                        <p className={styles.error} role="alert">
                            Não foi possível carregar as trilhas agora. Tente novamente em instantes.
                        </p>
                    )}

                    {!lessonsQuery.data && !lessonsQuery.isError && <p className={styles.loading}>Carregando trilhas…</p>}

                    <div className={styles.grid}>
                        {groups.map((group) => (
                            <TrackCard key={group.trackNumber} group={group} onClick={() => handleTrackClick(group.trackNumber)} />
                        ))}
                    </div>
                </div>

                <aside className={styles.sidebar}>
                    {progressionQuery.data && streakQuery.data && (
                        <ProgressionSummary progression={progressionQuery.data} streak={streakQuery.data} nextUnlock={nextUnlock} />
                    )}
                    {lessons.length > 0 && <ResumeLessonCard lessons={lessons} />}
                </aside>
            </div>
        </main>
    )
}

function TrackCard({ group, onClick }: { group: TrackGroup; onClick: () => void }) {
    const status = trackStatusFor(group)
    const statusLabel = STATUS_LABEL[status]
    const done = group.lessons.filter((lesson) => lesson.status === 'completed').length
    const total = group.lessons.length
    const completionPct = total === 0 ? 0 : Math.round((done / total) * 100)
    const track = TRACKS.find((candidate) => candidate.number === group.trackNumber)
    const accent = track?.color ?? 'var(--color-text-muted)'
    const accentBg = track?.background ?? 'var(--color-bg-surface-elevated)'
    const ticker = track?.ticker ?? `TRLH${group.trackNumber}`
    const { linePath, fillPath } = computeTrackHubSparkline(group.trackNumber, completionPct)

    return (
        <button
            type="button"
            className={[styles.trackCard, status === 'locked' && styles.locked].filter(Boolean).join(' ')}
            style={{ '--accent': accent, '--accent-bg': accentBg } as CSSProperties}
            onClick={onClick}
            aria-label={`${group.trackName}, ${statusLabel}, ${done} de ${total} lições concluídas`}
        >
            <span className={styles.top}>
                <span className={styles.identity}>
                    <span className={styles.ticker}>{ticker}</span>
                    <span className={styles.cardTitle}>{group.trackName}</span>
                </span>
                <span className={[styles.statusPill, styles[`status_${status}`]].join(' ')}>
                    <span className={styles.dot} aria-hidden="true" />
                    {statusLabel}
                </span>
            </span>

            <svg
                className={styles.sparkline}
                viewBox={`0 0 ${TRACK_HUB_SPARKLINE_WIDTH} ${TRACK_HUB_SPARKLINE_HEIGHT}`}
                preserveAspectRatio="none"
                aria-hidden="true"
            >
                <path d={fillPath} fill={accent} opacity={0.16} />
                <path d={linePath} fill="none" stroke={accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>

            <span className={styles.footer}>
                <span className={styles.count}>
                    <b>{done}</b>/{total} lições
                </span>
                <span className={styles.candleRow} aria-hidden="true">
                    {group.lessons.map((lesson, index) => (
                        <span
                            key={lesson.id}
                            className={[
                                styles.candle,
                                lesson.status === 'completed' && styles.candleDone,
                                lesson.status === 'available' && styles.candleCurrent,
                            ]
                                .filter(Boolean)
                                .join(' ')}
                            style={{ height: `${6 + ((index * 37) % 12)}px` }}
                        />
                    ))}
                </span>
            </span>

            {status === 'locked' && (
                <span className={styles.hint}>
                    <Locked size={12} />
                    Desbloqueia ao concluir a trilha anterior
                </span>
            )}
        </button>
    )
}
