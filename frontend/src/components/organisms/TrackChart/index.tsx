import { useId } from 'react'
import { Check, Circle, Lock } from 'lucide-react'
import { computeTrackChartLayout, TRACK_CHART_HEIGHT, TRACK_CHART_WIDTH } from '../../../features/lessons/trackChartLayout'
import type { Lesson } from '../../../services/lessons'
import type { TrackChartProps } from './types'
import styles from './index.module.css'

export type { TrackChartProps } from './types'

const STATUS_ICON: Record<Lesson['status'], typeof Check> = {
    completed: Check,
    available: Circle,
    locked: Lock,
}

function statusLabel(lesson: Lesson): string {
    if (lesson.status === 'completed') return 'Concluída'
    if (lesson.status === 'available') return 'Disponível'
    return lesson.unlocksDescription ? `Bloqueada — libera ${lesson.unlocksDescription}` : 'Bloqueada'
}

function toPercent(value: number, total: number): string {
    return `${((value / total) * 100).toFixed(2)}%`
}

// Mapa da Trilha (tela 3.1) redesenhado como gráfico de ativo subindo
// (identidade-visual-padroes.md) — substitui a lista vertical de nós da
// 6.4 pra trilhas com 2+ lições (trilha de 1 lição continua como linha
// simples via `LessonNode`, ver `pages/Track`). Coordenadas em unidades
// virtuais (`TRACK_CHART_WIDTH/HEIGHT`) posicionadas em porcentagem — o
// mesmo layout serve pro card estreito do mobile e pro card largo do
// desktop, só o container muda (§7 do doc de padrões).
export function TrackChart({ lessons, expandedHintId, onNodeClick }: TrackChartProps) {
    const gradientId = useId()
    const patternId = useId()
    const layout = computeTrackChartLayout(lessons)

    if (!layout) return null

    return (
        <div className={styles.card}>
            <div className={styles.chart} style={{ aspectRatio: `${TRACK_CHART_WIDTH} / ${TRACK_CHART_HEIGHT}` }}>
                <svg
                    viewBox={`0 0 ${TRACK_CHART_WIDTH} ${TRACK_CHART_HEIGHT}`}
                    className={styles.svg}
                    preserveAspectRatio="none"
                    aria-hidden="true"
                >
                    <defs>
                        <pattern id={patternId} width="28" height="28" patternUnits="userSpaceOnUse">
                            <path d="M28 0 L0 0 0 28" fill="none" stroke="rgba(255,255,255,0.035)" strokeWidth={1} />
                        </pattern>
                        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#f0a202" />
                            <stop offset="70%" stopColor="#f0a202" />
                            <stop offset="100%" stopColor="#2f6fed" />
                        </linearGradient>
                    </defs>
                    <rect x={0} y={0} width={TRACK_CHART_WIDTH} height={TRACK_CHART_HEIGHT} fill={`url(#${patternId})`} />
                    {layout.fillPath && <path d={layout.fillPath} fill={`url(#${gradientId})`} opacity={0.22} />}
                    {layout.solidPath && (
                        <path
                            d={layout.solidPath}
                            fill="none"
                            stroke={`url(#${gradientId})`}
                            strokeWidth={3}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    )}
                    {layout.dashedPath && (
                        <path
                            d={layout.dashedPath}
                            fill="none"
                            stroke="var(--color-border-strong)"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray="1 9"
                        />
                    )}
                    {layout.currentPoint && (
                        <line
                            x1={layout.currentPoint.x}
                            y1={layout.currentPoint.y}
                            x2={TRACK_CHART_WIDTH - 12}
                            y2={layout.currentPoint.y}
                            stroke="var(--color-border-strong)"
                            strokeWidth={1}
                            strokeDasharray="2 6"
                        />
                    )}
                </svg>

                {layout.currentPoint && (
                    <span
                        className={styles.hereTag}
                        style={{
                            left: toPercent(layout.currentPoint.x, TRACK_CHART_WIDTH),
                            top: toPercent(layout.currentPoint.y, TRACK_CHART_HEIGHT),
                        }}
                    >
                        você está aqui
                    </span>
                )}

                {layout.points.map((point) => {
                    const StatusIcon = STATUS_ICON[point.lesson.status]
                    return (
                        <button
                            key={point.lesson.id}
                            type="button"
                            className={[styles.node, styles[point.lesson.status]].join(' ')}
                            style={{ left: toPercent(point.x, TRACK_CHART_WIDTH), top: toPercent(point.y, TRACK_CHART_HEIGHT) }}
                            onClick={() => onNodeClick(point.lesson)}
                            aria-label={`${point.lesson.title} — ${statusLabel(point.lesson)}`}
                        >
                            <StatusIcon size={16} strokeWidth={2.5} fill={point.lesson.status === 'available' ? 'currentColor' : 'none'} />
                        </button>
                    )
                })}
            </div>

            {expandedHintId && layout.points.some((point) => point.lesson.id === expandedHintId) && (
                <p className={styles.hint}>Conclua a lição anterior pra desbloquear.</p>
            )}
        </div>
    )
}
