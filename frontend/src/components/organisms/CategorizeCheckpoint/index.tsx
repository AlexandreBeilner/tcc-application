import { useEffect, useRef, useState } from 'react'
import { Button } from '../../atoms/Button'
import { StreakSeal } from '../../molecules/StreakSeal'
import { assignItem, completeAssignment, emptyAssignment, itemsInGroup, pileItems } from '../../../features/lessons/categorizeBoard'
import type { Assignment } from '../../../features/lessons/categorizeBoard'
import { orderHintMessage } from '../../../features/lessons/orderList'
import type { CategorizeCheckpointProps } from './types'
import styles from './index.module.css'

export type { CategorizeCheckpointProps } from './types'

// Pergunta de agrupar (LJ.2.4, bloco `check` com `kind: 'categorize'`): toque no item e depois no grupo.
// Funciona igual no mouse, no toque e no teclado (itens e grupos são botões; sem arrastar). O item pode ser
// trocado de grupo antes de enviar, e só envia com todos agrupados. Errar não avança e mostra só a contagem
// ("3 de 5 no lugar certo", LJ-D2), sem dizer quais itens. O gabarito vive no servidor.
export function CategorizeCheckpoint({ block, view, pending, error, isReview, onSubmit }: CategorizeCheckpointProps) {
    const [assignment, setAssignment] = useState<Assignment>(view.groups ?? emptyAssignment(block.items.length))
    const [selected, setSelected] = useState<number | undefined>(undefined)
    const feedbackRef = useRef<HTMLParagraphElement>(null)
    const locked = view.solved
    // O encaixe só anima a resolução desta sessão (a explicação não vem na restauração).
    const celebrate = locked && view.explanation !== undefined && !isReview
    const answer = completeAssignment(assignment)
    const pile = pileItems(assignment)

    useEffect(() => {
        if (view.lastAttemptWrong) feedbackRef.current?.focus()
    }, [view.lastAttemptWrong, view.attempts])

    function chooseItem(item: number) {
        if (locked) return
        setSelected((current) => (current === item ? undefined : item))
    }

    function dropInGroup(group: number) {
        if (selected === undefined || locked) return
        setAssignment((current) => assignItem(current, selected, group))
        setSelected(undefined)
    }

    function chip(item: number, position: number) {
        return (
            <li key={item}>
                <button
                    type="button"
                    className={[styles.chip, selected === item && styles.selected, celebrate && styles.fit].filter(Boolean).join(' ')}
                    style={{ '--i': position } as React.CSSProperties}
                    aria-pressed={selected === item}
                    disabled={locked}
                    onClick={() => chooseItem(item)}
                >
                    {block.items[item]}
                </button>
            </li>
        )
    }

    return (
        <section className={styles.check} aria-label="Pergunta">
            <span className={styles.eyebrow}>Pergunta</span>
            <p className={styles.prompt}>{block.prompt}</p>

            <div className={styles.board} data-lesson-widget="">
                {!locked && (
                    <div className={styles.pile}>
                        <p className={styles.legend}>
                            {selected === undefined ? 'Toque num item e depois no grupo dele.' : 'Agora toque no grupo.'}
                        </p>
                        {pile.length > 0 ? (
                            <ul className={styles.chips} aria-label="Itens para agrupar">
                                {pile.map((item, position) => chip(item, position))}
                            </ul>
                        ) : (
                            <p className={styles.legend}>Todos agrupados. Toque num item para trocar de grupo.</p>
                        )}
                    </div>
                )}

                <div className={styles.groups}>
                    {block.groups.map((name, group) => {
                        const members = itemsInGroup(assignment, group)
                        return (
                            <div key={name} className={[styles.group, selected !== undefined && styles.ready].filter(Boolean).join(' ')}>
                                <button
                                    type="button"
                                    className={styles.groupTitle}
                                    disabled={locked || selected === undefined}
                                    aria-label={selected === undefined ? name : `Colocar ${block.items[selected]} em ${name}`}
                                    onClick={() => dropInGroup(group)}
                                >
                                    {name}
                                </button>
                                {members.length > 0 ? (
                                    <ul className={styles.chips} aria-label={`Itens em ${name}`}>
                                        {members.map((item, position) => chip(item, position))}
                                    </ul>
                                ) : (
                                    <p className={styles.empty}>Vazio</p>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {view.lastAttemptWrong && !view.solved && (
                <p ref={feedbackRef} tabIndex={-1} role="alert" className={styles.feedback}>
                    {view.hint ? `${orderHintMessage(view.hint.correctCount, view.hint.total)} ` : 'Ainda não. '}
                    Troque o que achar que está no grupo errado e tente de novo.
                </p>
            )}

            {view.solved && (
                <div role="status" className={styles.solved}>
                    <p className={styles.badge}>
                        {isReview
                            ? 'Agrupamento certo.'
                            : view.firstTry
                              ? 'Acertou de primeira.'
                              : `Acertou na ${view.attempts}ª tentativa.`}
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
                    <Button
                        onClick={() => answer && onSubmit({ groups: answer })}
                        disabled={pending || answer === undefined}
                        data-lesson-submit=""
                    >
                        Responder
                    </Button>
                </div>
            )}
        </section>
    )
}
