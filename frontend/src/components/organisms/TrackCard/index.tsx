import type { CSSProperties } from 'react'
import { trackStatusFor } from '../../../features/lessons/trackGroups'
import type { TrackStatus } from '../../../features/lessons/trackGroups'
import {
    computeTrackHubSparkline,
    TRACK_HUB_SPARKLINE_HEIGHT,
    TRACK_HUB_SPARKLINE_WIDTH,
} from '../../../features/lessons/trackHubSparkline'
import { Locked } from '../../atoms/Locked'
import { TRACKS, isParallelTrack } from '../../../utils/tracks'
import type { TrackCardProps } from './types'
import styles from './index.module.css'

export type { TrackCardProps } from './types'

const STATUS_LABEL: Record<TrackStatus, string> = {
    completed: 'Concluída',
    active: 'Em andamento',
    locked: 'Bloqueada',
}

// Card de trilha do Hub (tarefa O.1, extraído de `pages/TrilhasHub` na
// revisão do PR de ajustes de frontend — organism com complexidade visual
// própria, atomic design exige morar em `components/`, não inline na
// página) — espírito de watchlist, uma trilha = um "ativo".
export function TrackCard({ group, onClick }: TrackCardProps) {
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

            {isParallelTrack(group.trackNumber) && <span className={styles.hint}>Trilha paralela: abra em qualquer ordem</span>}

            {status === 'locked' && (
                <span className={styles.hint}>
                    <Locked size={12} />
                    Desbloqueia ao concluir a trilha anterior
                </span>
            )}
        </button>
    )
}
