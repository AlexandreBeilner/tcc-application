import type { CSSProperties } from 'react'
import { useEffect, useRef } from 'react'
import { Check, Circle, Flag } from 'lucide-react'
import { computeTrackPathLayout, TRACK_PATH_WIDTH } from '../../../features/lessons/trackPathLayout'
import { Locked } from '../../atoms/Locked'
import type { Lesson } from '../../../services/lessons'
import type { TrackPathProps } from './types'
import styles from './index.module.css'

export type { TrackPathProps } from './types'

const STATUS_ICON: Record<'completed' | 'available', typeof Check> = {
    completed: Check,
    available: Circle,
}

function statusLabel(lesson: Lesson): string {
    if (lesson.status === 'completed') return 'Concluída'
    if (lesson.status === 'available') return 'Disponível'
    return lesson.unlocksDescription ? `Bloqueada: libera ${lesson.unlocksDescription}` : 'Bloqueada'
}

function toPercent(value: number): string {
    return `${((value / TRACK_PATH_WIDTH) * 100).toFixed(2)}%`
}

// Mapa vertical por trilha (tarefa O.3, mockup vivo em
// `.claude/backlog-engajamento-gamificacao.md` Fase O/O.0) — substitui o
// gráfico horizontal antigo (retirado de verdade na O.4) por um path que
// desce a página em vez de rolar de lado. Coordenadas de `trackPathLayout`
// (O.2) são unidades virtuais: `y` vira `top` real em px (a altura cresce
// sem limite com o nº de lições, sem aspect-ratio fixo pra preservar), `x`
// vira `left` em porcentagem de `TRACK_PATH_WIDTH` (mesma técnica que o
// gráfico horizontal antigo usava, responsivo à largura real do container).
// O nó fica sempre ancorado na coordenada exata do path — título/bandeira
// são posicionados a PARTIR dele (`.nodeWrap`, âncora de tamanho zero),
// nunca o inverso.
export function TrackPath({ lessons, accentColor, expandedHintId, onNodeClick }: TrackPathProps) {
    const layout = computeTrackPathLayout(lessons)
    const hasCenteredRef = useRef(false)
    const currentNodeRef = useRef<HTMLDivElement>(null)

    // Abre já rolado até o nó "você está aqui" (a lição `available`, ou a
    // última `completed` se a trilha inteira já foi concluída) — mesmo
    // princípio do `useEffect` de centralização do gráfico horizontal antigo
    // (tarefa L.1), eixo trocado: aqui é a rolagem NATIVA da página que
    // centraliza, não um container próprio. Só na montagem, mesma guarda
    // (`hasCenteredRef`) pra nunca brigar com uma rolagem manual depois.
    useEffect(() => {
        if (hasCenteredRef.current) return
        hasCenteredRef.current = true
        currentNodeRef.current?.scrollIntoView?.({ block: 'center' })
    })

    if (!layout) return null

    const target = layout.currentPoint ?? layout.points[layout.points.length - 1]
    const centerX = TRACK_PATH_WIDTH / 2

    return (
        <div className={styles.wrapper} style={{ '--accent': accentColor } as CSSProperties}>
            <div className={styles.canvas} style={{ height: layout.height }}>
                <svg
                    className={styles.svg}
                    viewBox={`0 0 ${TRACK_PATH_WIDTH} ${layout.height}`}
                    width="100%"
                    height={layout.height}
                    preserveAspectRatio="none"
                    aria-hidden="true"
                >
                    <defs>
                        <pattern id="trackPathGrid" width="28" height="28" patternUnits="userSpaceOnUse">
                            <path d="M28 0 L0 0 0 28" fill="none" stroke="rgba(255,255,255,0.035)" strokeWidth={1} />
                        </pattern>
                    </defs>
                    <rect x={0} y={0} width={TRACK_PATH_WIDTH} height={layout.height} fill="url(#trackPathGrid)" />
                    {layout.solidPath && (
                        <path
                            d={layout.solidPath}
                            fill="none"
                            stroke={accentColor}
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
                </svg>

                {/* "Você está aqui" (identidade-visual-padroes.md §2) — linha-guia
                    tracejada + etiqueta na altura da lição `available`, mesmo motivo
                    já usado no gráfico horizontal, agora persistente (não só hover). */}
                {layout.currentPoint && (
                    <div className={styles.hereMarker} style={{ top: layout.currentPoint.y }}>
                        <span className={styles.hereTag}>Você está aqui</span>
                    </div>
                )}

                {layout.points.map((point) => {
                    const StatusIcon = point.lesson.status === 'locked' ? null : STATUS_ICON[point.lesson.status]
                    // Título ancora pro lado do centro do canvas — nunca corre risco
                    // de sair da borda do card, seja qual for o lado do zigue-zague.
                    const metaSide = point.x < centerX ? styles.metaRight : styles.metaLeft

                    return (
                        <div
                            key={point.lesson.id}
                            ref={point.lesson.id === target.lesson.id ? currentNodeRef : undefined}
                            className={styles.nodeWrap}
                            style={{ top: point.y, left: toPercent(point.x) }}
                        >
                            <button
                                type="button"
                                className={[styles.node, styles[point.lesson.status]].join(' ')}
                                onClick={() => onNodeClick(point.lesson)}
                                aria-label={`${point.lesson.title}: ${statusLabel(point.lesson)}`}
                            >
                                {StatusIcon ? (
                                    <StatusIcon
                                        size={18}
                                        strokeWidth={2.5}
                                        fill={point.lesson.status === 'available' ? 'currentColor' : 'none'}
                                    />
                                ) : (
                                    <Locked size={18} />
                                )}
                            </button>

                            <div className={[styles.nodeMeta, metaSide].join(' ')}>
                                <span className={styles.nodeCode}>{point.lesson.code}</span>
                                <span
                                    className={[styles.nodeTitle, point.lesson.status === 'locked' && styles.nodeTitleLocked]
                                        .filter(Boolean)
                                        .join(' ')}
                                >
                                    {point.lesson.title}
                                </span>
                                {/* Aviso inline no próprio nó clicado (não uma única
                                    mensagem no fim da página, como o gráfico
                                    horizontal antigo fazia) — um mapa de 15 lições é alto
                                    demais pra um aviso lá embaixo ser notado depois de
                                    clicar num nó bloqueado no meio do caminho. */}
                                {point.lesson.id === expandedHintId && (
                                    <p className={styles.hint}>Conclua a lição anterior pra desbloquear.</p>
                                )}
                            </div>

                            {/* Bandeira de marco (mockup O.0) — cor dourada de conquista
                                (`--color-gamify-500`), nunca a cor da trilha, pra não
                                confundir "libera produto real" com progresso comum. */}
                            {point.lesson.unlocksDescription && (
                                <span className={styles.flag}>
                                    <Flag size={11} strokeWidth={2.4} aria-hidden="true" />
                                    Libera {point.lesson.unlocksDescription}
                                </span>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
