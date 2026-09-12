import { useEffect, useId, useRef } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import { Check, Circle } from 'lucide-react'
import { computeTrackChartLayout, TRACK_CHART_HEIGHT, TRACK_CHART_WIDTH } from '../../../features/lessons/trackChartLayout'
import { Locked } from '../../atoms/Locked'
import type { Lesson } from '../../../services/lessons'
import type { TrackChartProps } from './types'
import styles from './index.module.css'

export type { TrackChartProps } from './types'

const STATUS_ICON: Record<'completed' | 'available', typeof Check> = {
    completed: Check,
    available: Circle,
}

// Só um "arrasto de verdade" suprime o clique do nó embaixo do ponteiro
// (tarefa L.1) — abaixo disso é ruído de mão trêmula/clique normal, não
// intenção de rolar.
const DRAG_THRESHOLD_PX = 4

function statusLabel(lesson: Lesson): string {
    if (lesson.status === 'completed') return 'Concluída'
    if (lesson.status === 'available') return 'Disponível'
    return lesson.unlocksDescription ? `Bloqueada: libera ${lesson.unlocksDescription}` : 'Bloqueada'
}

function toPercent(value: number, total: number): string {
    return `${((value / total) * 100).toFixed(2)}%`
}

// Mapa da Trilha (tela 3.1) redesenhado como gráfico de ativo subindo
// (identidade-visual-padroes.md) — substitui a lista vertical de nós da
// 6.4 pra trilhas com 2+ lições (trilha de 1 lição continua como linha
// simples via `LessonNode`, ver `pages/Track`). Coordenadas em unidades
// virtuais (`TRACK_CHART_WIDTH`/`TRACK_CHART_HEIGHT`, sempre fixas —
// viewBox/percentuais nunca mudam, pra nunca distorcer a curva/grade de
// fundo) posicionadas em porcentagem. `layout.width` (tarefa L.1) é a
// largura REAL mínima em px pro nº de lições desta trilha — só usada como
// `style.width` do card (com `min-width: 100%` no CSS garantindo que ela
// nunca encolhe uma trilha pequena); quando ela excede o container, a
// MESMA posição percentual de sempre passa a valer mais px reais, sem
// tocar no espaço virtual. `.chartScroll` ao redor vira rolável (nativo
// por toque, arrasto por ponteiro no mouse) em vez de comprimir o
// espaçamento nesse caso.
export function TrackChart({ lessons, expandedHintId, onNodeClick }: TrackChartProps) {
    const gradientId = useId()
    const patternId = useId()
    const layout = computeTrackChartLayout(lessons)

    const scrollRef = useRef<HTMLDivElement>(null)
    const chartRef = useRef<HTMLDivElement>(null)
    const dragRef = useRef<{ pointerId: number; startX: number; startScrollLeft: number; dragged: boolean } | null>(null)
    // Sobrevive ao `endDrag` de propósito — o `click` do nó só chega DEPOIS
    // do `pointerup` (ordem de eventos do navegador), então `dragRef` já
    // teria sido limpo antes do `handleClickCapture` rodar se o arrasto não
    // ficasse guardado em algum lugar que não morre com o `pointerup`.
    const suppressNextClickRef = useRef(false)
    const hasCenteredRef = useRef(false)

    // Abre já rolado até o nó "você está aqui" (a lição `available`, ou a
    // última `completed` se a trilha inteira já foi concluída), sem exigir
    // rolagem manual pra achar o progresso numa trilha comprida. Só na
    // montagem — reordenar/atualizar `lessons` depois não deve recentralizar
    // e brigar com uma rolagem manual do usuário.
    useEffect(() => {
        if (hasCenteredRef.current) return
        hasCenteredRef.current = true

        const scrollEl = scrollRef.current
        const chartEl = chartRef.current
        if (!scrollEl || !chartEl || !layout) return

        const target = layout.currentPoint ?? layout.points[layout.points.length - 1]
        const chartWidthPx = chartEl.getBoundingClientRect().width
        const targetPx = (target.x / TRACK_CHART_WIDTH) * chartWidthPx
        const maxScrollLeft = scrollEl.scrollWidth - scrollEl.clientWidth
        scrollEl.scrollLeft = Math.max(0, Math.min(targetPx - scrollEl.clientWidth / 2, maxScrollLeft))
    })

    if (!layout) return null

    function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
        if (event.pointerType !== 'mouse') return // touch já rola nativo, sem handler manual

        const scrollEl = scrollRef.current
        if (!scrollEl) return

        dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startScrollLeft: scrollEl.scrollLeft, dragged: false }
        scrollEl.setPointerCapture?.(event.pointerId)
    }

    function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
        const drag = dragRef.current
        const scrollEl = scrollRef.current
        if (!drag || !scrollEl || drag.pointerId !== event.pointerId) return

        const delta = event.clientX - drag.startX
        if (Math.abs(delta) > DRAG_THRESHOLD_PX) drag.dragged = true
        scrollEl.scrollLeft = drag.startScrollLeft - delta
    }

    function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
        const scrollEl = scrollRef.current
        if (scrollEl?.hasPointerCapture?.(event.pointerId)) scrollEl.releasePointerCapture(event.pointerId)
        if (dragRef.current?.pointerId === event.pointerId) {
            if (dragRef.current.dragged) suppressNextClickRef.current = true
            dragRef.current = null
        }
    }

    // Suprime o clique do nó quando o gesto que acabou de terminar embaixo
    // dele foi um arrasto de rolagem, não uma intenção de clicar (captura,
    // não bolha — corre antes do onClick do próprio botão do nó). Só o
    // PRÓXIMO clique é suprimido — a flag reseta assim que consumida, senão
    // um clique de verdade depois de um arrasto ficaria preso.
    function handleClickCapture(event: ReactMouseEvent<HTMLDivElement>) {
        if (suppressNextClickRef.current) {
            suppressNextClickRef.current = false
            event.preventDefault()
            event.stopPropagation()
        }
    }

    return (
        <div className={styles.card}>
            <div
                ref={scrollRef}
                className={styles.chartScroll}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onClickCapture={handleClickCapture}
            >
                <div
                    ref={chartRef}
                    className={styles.chart}
                    style={{ width: layout.width, aspectRatio: `${TRACK_CHART_WIDTH} / ${TRACK_CHART_HEIGHT}` }}
                >
                    <div className={styles.chartBg}>
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
                        </svg>
                    </div>

                    {/* Sem "você está aqui": o anel sólido + pulso do estado `available`
                        (index.module.css) já diferencia esse ponto dos demais — texto
                        seria redundante. Tooltip no hover/focus mostra título e status de
                        qualquer ponto, incluindo os bloqueados/futuros (pedido do autor). */}
                    {layout.points.map((point) => {
                        const StatusIcon = point.lesson.status === 'locked' ? null : STATUS_ICON[point.lesson.status]
                        const tooltipBelow = point.y < TRACK_CHART_HEIGHT * 0.3
                        // Mesmo raciocínio do `tooltipBelow` (flip vertical perto do topo),
                        // agora pro eixo horizontal (tarefa 6.9.7) — ancora pela ponta em vez
                        // de centralizar quando o nó está perto da borda do `.chart`, pra não
                        // empurrar o tooltip (centralizado por padrão) pra fora do container.
                        const tooltipLeft = point.x < TRACK_CHART_WIDTH * 0.12
                        const tooltipRight = point.x > TRACK_CHART_WIDTH * 0.88

                        return (
                            <button
                                key={point.lesson.id}
                                type="button"
                                className={[styles.node, styles[point.lesson.status]].join(' ')}
                                style={{ left: toPercent(point.x, TRACK_CHART_WIDTH), top: toPercent(point.y, TRACK_CHART_HEIGHT) }}
                                onClick={() => onNodeClick(point.lesson)}
                                aria-label={`${point.lesson.title}: ${statusLabel(point.lesson)}`}
                            >
                                {StatusIcon ? (
                                    <StatusIcon
                                        size={16}
                                        strokeWidth={2.5}
                                        fill={point.lesson.status === 'available' ? 'currentColor' : 'none'}
                                    />
                                ) : (
                                    <Locked size={16} />
                                )}
                                <span
                                    className={[
                                        styles.tooltip,
                                        tooltipBelow && styles.tooltipBelow,
                                        tooltipLeft && styles.tooltipLeft,
                                        tooltipRight && styles.tooltipRight,
                                    ]
                                        .filter(Boolean)
                                        .join(' ')}
                                    aria-hidden="true"
                                >
                                    <span className={styles.tooltipTitle}>{point.lesson.title}</span>
                                    <span className={styles.tooltipStatus}>{statusLabel(point.lesson)}</span>
                                </span>
                            </button>
                        )
                    })}
                </div>
            </div>

            {expandedHintId && layout.points.some((point) => point.lesson.id === expandedHintId) && (
                <p className={styles.hint}>Conclua a lição anterior pra desbloquear.</p>
            )}
        </div>
    )
}
