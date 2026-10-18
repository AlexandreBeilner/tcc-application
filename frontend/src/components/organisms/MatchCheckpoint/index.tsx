import { useState } from 'react'
import { StreakSeal } from '../../molecules/StreakSeal'
import type { MatchCheckpointProps } from './types'
import styles from './index.module.css'

export type { MatchCheckpointProps } from './types'

// Pergunta de ligar pares (LJ.2.5, bloco `check` com `kind: 'match'`): duas colunas; toque num item da esquerda
// e depois num da direita. O servidor confere o par na hora (LJ-D3): par certo trava com um número igual nos
// dois lados; par errado treme e se desfaz (com `prefers-reduced-motion`, vira uma borda), sem dizer qual
// era o certo. Termina quando todos os pares travam. O gabarito vive no servidor.
export function MatchCheckpoint({ block, view, pending, error, isReview, onSubmit }: MatchCheckpointProps) {
    const [left, setLeft] = useState<number | undefined>(undefined)
    const [right, setRight] = useState<number | undefined>(undefined)
    // Última recusa cujo tremor já terminou (o CSS avisa por `onAnimationEnd`); a recusa mais nova ainda treme.
    const [settledMiss, setSettledMiss] = useState<number | undefined>(undefined)
    const pairs = view.matched ?? []
    const locked = view.solved
    // Cada recusa balança os dois itens por um instante.
    const shaking = view.lastMiss && view.lastMiss.n !== settledMiss ? view.lastMiss : undefined

    const lockedLeft = (item: number) => pairs.findIndex(([l]) => l === item)
    const lockedRight = (item: number) => pairs.findIndex(([, r]) => r === item)

    function choose(side: 'left' | 'right', item: number) {
        if (locked || pending) return
        const nextLeft = side === 'left' ? (left === item ? undefined : item) : left
        const nextRight = side === 'right' ? (right === item ? undefined : item) : right
        if (nextLeft !== undefined && nextRight !== undefined) {
            setLeft(undefined)
            setRight(undefined)
            onSubmit({ pair: [nextLeft, nextRight] })
            return
        }
        setLeft(nextLeft)
        setRight(nextRight)
    }

    function cell(side: 'left' | 'right', item: number, text: string) {
        const order = side === 'left' ? lockedLeft(item) : lockedRight(item)
        const isLocked = order >= 0
        const selected = side === 'left' ? left === item : right === item
        const shake = shaking !== undefined && (side === 'left' ? shaking.left === item : shaking.right === item)
        return (
            <li key={`${side}-${item}`}>
                <button
                    type="button"
                    className={[styles.cell, isLocked && styles.locked, selected && styles.selected, shake && styles.shake]
                        .filter(Boolean)
                        .join(' ')}
                    aria-pressed={isLocked ? undefined : selected}
                    aria-disabled={isLocked || locked || undefined}
                    disabled={isLocked || locked}
                    onClick={() => choose(side, item)}
                    onAnimationEnd={() => shake && setSettledMiss(shaking?.n)}
                >
                    {isLocked && (
                        <span className={styles.tag} aria-hidden="true">
                            {order + 1}
                        </span>
                    )}
                    <span>{text}</span>
                    {isLocked && <span className={styles.srOnly}> (ligado, par {order + 1})</span>}
                </button>
            </li>
        )
    }

    return (
        <section className={styles.check} aria-label="Pergunta">
            <span className={styles.eyebrow}>Pergunta</span>
            <p className={styles.prompt}>{block.prompt}</p>

            <div className={styles.board} data-lesson-widget="">
                <ul className={styles.column} aria-label="Coluna da esquerda">
                    {block.left.map((text, item) => cell('left', item, text))}
                </ul>
                <ul className={styles.column} aria-label="Coluna da direita">
                    {block.right.map((text, item) => cell('right', item, text))}
                </ul>
            </div>

            <p role="status" className={styles.feedback}>
                {shaking !== undefined
                    ? 'Esse par não combina. Tente outro.'
                    : !locked && left !== undefined
                      ? 'Agora toque no item da outra coluna.'
                      : !locked && right !== undefined
                        ? 'Agora toque no item da coluna da esquerda.'
                        : ''}
            </p>

            {view.solved && (
                <div role="status" className={styles.solved}>
                    <p className={styles.badge}>
                        {isReview ? 'Tudo ligado.' : view.firstTry ? 'Acertou de primeira.' : 'Ligou todos os pares.'}
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
        </section>
    )
}
