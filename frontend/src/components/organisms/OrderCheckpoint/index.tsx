import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Button } from '../../atoms/Button'
import { StreakSeal } from '../../molecules/StreakSeal'
import { indexAtY, moveItem, orderHintMessage } from '../../../features/lessons/orderList'
import type { OrderCheckpointProps } from './types'
import styles from './index.module.css'

export type { OrderCheckpointProps } from './types'

type Direction = 'up' | 'down'

// Pergunta de ordenar (LJ.2.3, bloco `check` com `kind: 'order'`): a pessoa monta a ordem de cima para
// baixo. Os botões subir/descer em cada item são o caminho de teclado e de toque; arrastar pela alça é um
// atalho a mais (eventos de ponteiro nativos, sem biblioteca). Errar não avança e mostra só a contagem
// ("3 de 5 no lugar certo", LJ-D2), sem dizer quais itens. O servidor entrega os itens embaralhados e a
// ordem certa só existe lá.
export function OrderCheckpoint({ block, view, pending, error, isReview, onSubmit }: OrderCheckpointProps) {
    const initial = view.sequence ?? block.items.map((_, index) => index)
    const [sequence, setSequence] = useState<number[]>(initial)
    const [announcement, setAnnouncement] = useState('')
    const [dragging, setDragging] = useState<number | undefined>(undefined)
    const rowRefs = useRef(new Map<number, HTMLLIElement>())
    const moveRefs = useRef(new Map<string, HTMLButtonElement>())
    const pendingFocus = useRef<{ item: number; direction: Direction } | null>(null)
    const feedbackRef = useRef<HTMLParagraphElement>(null)
    const locked = view.solved
    // O selo só anima a resolução desta sessão (a explicação não vem na restauração).
    const celebrate = locked && view.explanation !== undefined && !isReview

    useEffect(() => {
        if (view.lastAttemptWrong) feedbackRef.current?.focus()
    }, [view.lastAttemptWrong, view.attempts])

    // O React move a linha no DOM e o navegador pode soltar o foco do botão: devolve depois de cada movimento.
    useLayoutEffect(() => {
        const target = pendingFocus.current
        if (!target) return
        pendingFocus.current = null
        const wanted = moveRefs.current.get(`${target.item}-${target.direction}`)
        const fallback = moveRefs.current.get(`${target.item}-${target.direction === 'up' ? 'down' : 'up'}`)
        ;(wanted && !wanted.disabled ? wanted : fallback)?.focus()
    }, [sequence])

    useEffect(() => {
        if (dragging === undefined) return
        const item = dragging
        function handleMove(event: PointerEvent) {
            const rows = sequence.map((entry) => rowRefs.current.get(entry)?.getBoundingClientRect() ?? { top: 0, bottom: 0 })
            const target = indexAtY(rows, event.clientY)
            const from = sequence.indexOf(item)
            if (target !== from) setSequence(moveItem(sequence, from, target))
        }
        function handleEnd() {
            setDragging(undefined)
        }
        window.addEventListener('pointermove', handleMove)
        window.addEventListener('pointerup', handleEnd)
        window.addEventListener('pointercancel', handleEnd)
        return () => {
            window.removeEventListener('pointermove', handleMove)
            window.removeEventListener('pointerup', handleEnd)
            window.removeEventListener('pointercancel', handleEnd)
        }
    }, [dragging, sequence])

    function move(item: number, direction: Direction) {
        const from = sequence.indexOf(item)
        const to = direction === 'up' ? from - 1 : from + 1
        if (to < 0 || to >= sequence.length) return
        pendingFocus.current = { item, direction }
        setSequence(moveItem(sequence, from, to))
        setAnnouncement(`${block.items[item]}: posição ${to + 1} de ${sequence.length}`)
    }

    function handleSubmit() {
        onSubmit({ sequence })
    }

    return (
        <section className={styles.check} aria-label="Pergunta">
            <span className={styles.eyebrow}>Pergunta</span>
            <p className={styles.prompt}>{block.prompt}</p>

            <div className={styles.board} data-lesson-widget="">
                {block.lowLabel && <p className={styles.endLabel}>{block.lowLabel}</p>}
                <ol className={styles.list} aria-label="Itens para ordenar, de cima para baixo">
                    {sequence.map((item, position) => (
                        <li
                            key={item}
                            ref={(node) => {
                                if (node) rowRefs.current.set(item, node)
                                else rowRefs.current.delete(item)
                            }}
                            className={[styles.row, dragging === item && styles.dragged, celebrate && styles.fit].filter(Boolean).join(' ')}
                            style={{ '--i': position } as React.CSSProperties}
                        >
                            <span className={styles.position} aria-hidden="true">
                                {position + 1}
                            </span>
                            <span className={styles.text}>{block.items[item]}</span>
                            {!locked && (
                                <>
                                    <span
                                        className={styles.grip}
                                        aria-hidden="true"
                                        onPointerDown={(event) => {
                                            if (pending) return
                                            event.preventDefault()
                                            setDragging(item)
                                        }}
                                    >
                                        <GripVertical size={18} />
                                    </span>
                                    <span className={styles.moves}>
                                        <button
                                            type="button"
                                            className={styles.move}
                                            aria-label={`Subir ${block.items[item]}`}
                                            disabled={position === 0 || pending}
                                            ref={(node) => {
                                                if (node) moveRefs.current.set(`${item}-up`, node)
                                                else moveRefs.current.delete(`${item}-up`)
                                            }}
                                            onClick={() => move(item, 'up')}
                                        >
                                            <ArrowUp size={18} aria-hidden="true" />
                                        </button>
                                        <button
                                            type="button"
                                            className={styles.move}
                                            aria-label={`Descer ${block.items[item]}`}
                                            disabled={position === sequence.length - 1 || pending}
                                            ref={(node) => {
                                                if (node) moveRefs.current.set(`${item}-down`, node)
                                                else moveRefs.current.delete(`${item}-down`)
                                            }}
                                            onClick={() => move(item, 'down')}
                                        >
                                            <ArrowDown size={18} aria-hidden="true" />
                                        </button>
                                    </span>
                                </>
                            )}
                        </li>
                    ))}
                </ol>
                {block.highLabel && <p className={styles.endLabel}>{block.highLabel}</p>}
            </div>

            <p className={styles.srOnly} aria-live="polite">
                {announcement}
            </p>

            {view.lastAttemptWrong && !view.solved && (
                <p ref={feedbackRef} tabIndex={-1} role="alert" className={styles.feedback}>
                    {view.hint ? `${orderHintMessage(view.hint.correctCount, view.hint.total)} ` : 'Ainda não. '}
                    Ajuste a ordem e tente de novo.
                </p>
            )}

            {view.solved && (
                <div role="status" className={styles.solved}>
                    <p className={styles.badge}>
                        {isReview ? 'Ordem certa.' : view.firstTry ? 'Acertou de primeira.' : `Acertou na ${view.attempts}ª tentativa.`}
                    </p>
                    {view.explanation ? (
                        <p className={styles.explanation}>{view.explanation}</p>
                    ) : (
                        <p className={styles.explanation}>Você já resolveu esta pergunta.</p>
                    )}
                    {view.streakMilestone && !isReview && <StreakSeal milestone={view.streakMilestone} />}
                </div>
            )}

            {error && (
                <p role="alert" className={styles.feedback}>
                    Não foi possível enviar sua resposta agora. Tente de novo.
                </p>
            )}

            {!view.solved && (
                <div>
                    <Button onClick={handleSubmit} disabled={pending} data-lesson-submit="">
                        Responder
                    </Button>
                </div>
            )}
        </section>
    )
}
