import { useEffect, useRef, useState } from 'react'
import { Button } from '../../atoms/Button'
import type { LessonCheckpointProps } from './types'
import styles from './index.module.css'

export type { LessonCheckpointProps } from './types'

const TRUE_FALSE_OPTIONS = ['Verdadeiro', 'Falso']

// Pergunta intermediária da lição (bloco `check`, RC.3.2): única escolha,
// ou verdadeiro/falso. Errar nunca avança: a alternativa errada fica
// desativada (sem dica e sem gabarito) e dá pra tentar de novo; só o acerto
// trava a pergunta e mostra a explicação. O gabarito vive no servidor.
export function LessonCheckpoint({ block, view, pending, error, isReview, onSubmit }: LessonCheckpointProps) {
    const [selected, setSelected] = useState<number | undefined>(undefined)
    const feedbackRef = useRef<HTMLParagraphElement>(null)
    const options = block.kind === 'true_false' ? TRUE_FALSE_OPTIONS : (block.options ?? [])
    const wrong = new Set(view.wrongOptions)
    const canSubmit = !view.solved && !pending && selected !== undefined

    // Depois de um erro o botão focado acabou de ficar desativado: o foco vai pro aviso.
    useEffect(() => {
        if (view.lastAttemptWrong) feedbackRef.current?.focus()
    }, [view.lastAttemptWrong, view.attempts])

    function handleSubmit() {
        if (selected !== undefined) {
            const tried = selected
            setSelected(undefined)
            onSubmit({ selectedOption: tried })
        }
    }

    return (
        <section className={styles.check} aria-label="Pergunta">
            <span className={styles.eyebrow}>Pergunta</span>
            <p className={styles.prompt}>{block.prompt}</p>

            <div className={styles.options} role="group" aria-label="Escolha uma opção">
                {options.map((option, index) => {
                    const isWrong = wrong.has(index)
                    return (
                        <button
                            key={option}
                            type="button"
                            aria-pressed={selected === index}
                            className={[styles.option, selected === index && styles.selected, isWrong && styles.wrong]
                                .filter(Boolean)
                                .join(' ')}
                            disabled={isWrong || view.solved}
                            data-lesson-option=""
                            onClick={() => setSelected(index)}
                        >
                            {option}
                            {isWrong && <span className={styles.srOnly}> (alternativa descartada)</span>}
                        </button>
                    )
                })}
            </div>

            {view.lastAttemptWrong && !view.solved && (
                <p ref={feedbackRef} tabIndex={-1} role="alert" className={styles.feedback}>
                    Ainda não. Essa alternativa foi descartada, escolha outra.
                </p>
            )}

            {view.solved && (
                <div role="status" className={styles.solved}>
                    <p className={styles.badge}>
                        {isReview ? 'Resposta certa.' : view.firstTry ? 'Acertou de primeira.' : `Acertou na ${view.attempts}ª tentativa.`}
                    </p>
                    {view.explanation ? (
                        <p className={styles.explanation}>{view.explanation}</p>
                    ) : (
                        <p className={styles.explanation}>Você já resolveu esta pergunta.</p>
                    )}
                </div>
            )}

            {error && (
                <p role="alert" className={styles.feedback}>
                    Não foi possível enviar sua resposta agora. Tente de novo.
                </p>
            )}

            {!view.solved && (
                <div>
                    <Button onClick={handleSubmit} disabled={!canSubmit} data-lesson-submit="">
                        Responder
                    </Button>
                </div>
            )}
        </section>
    )
}
