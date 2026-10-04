import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '../../atoms/Button'
import type { LessonCheckpointProps } from './types'
import styles from './index.module.css'

export type { LessonCheckpointProps } from './types'

const TRUE_FALSE_OPTIONS = ['Verdadeiro', 'Falso']

function parseNumber(raw: string): number | undefined {
    const normalized = raw.trim().replace(',', '.')
    if (normalized === '') return undefined
    const value = Number(normalized)
    return Number.isFinite(value) ? value : undefined
}

// Pergunta intermediária da lição (bloco `check`, RC.3.2): única escolha,
// verdadeiro/falso ou numérica. Errar nunca avança: a alternativa errada fica
// desativada (sem dica e sem gabarito) e dá pra tentar de novo; só o acerto
// trava a pergunta e mostra a explicação. O gabarito vive no servidor.
export function LessonCheckpoint({ block, view, pending, error, isReview, onSubmit }: LessonCheckpointProps) {
    const [selected, setSelected] = useState<number | undefined>(undefined)
    const [rawValue, setRawValue] = useState('')
    const feedbackRef = useRef<HTMLParagraphElement>(null)
    const inputId = useId()
    const options = block.kind === 'true_false' ? TRUE_FALSE_OPTIONS : (block.options ?? [])
    const wrong = new Set(view.wrongOptions)
    const isNumeric = block.kind === 'numeric'
    const parsedValue = parseNumber(rawValue)
    const canSubmit = !view.solved && !pending && (isNumeric ? parsedValue !== undefined : selected !== undefined)

    // Depois de um erro o botão focado acabou de ficar desativado: o foco vai pro aviso.
    useEffect(() => {
        if (view.lastAttemptWrong) feedbackRef.current?.focus()
    }, [view.lastAttemptWrong, view.attempts])

    function handleSubmit() {
        if (isNumeric) {
            if (parsedValue !== undefined) onSubmit({ value: parsedValue })
        } else if (selected !== undefined) {
            const tried = selected
            setSelected(undefined)
            onSubmit({ selectedOption: tried })
        }
    }

    return (
        <section className={styles.check} aria-label="Pergunta">
            <span className={styles.eyebrow}>Pergunta</span>
            <p className={styles.prompt}>{block.prompt}</p>

            {isNumeric ? (
                <div className={styles.numeric}>
                    <label htmlFor={inputId} className={styles.numericLabel}>
                        Sua resposta{block.unit ? ` (${block.unit})` : ''}
                    </label>
                    <input
                        id={inputId}
                        className={styles.numericInput}
                        inputMode="decimal"
                        autoComplete="off"
                        value={rawValue}
                        disabled={view.solved}
                        aria-invalid={view.lastAttemptWrong || undefined}
                        onChange={(event) => setRawValue(event.target.value)}
                    />
                </div>
            ) : (
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
                                onClick={() => setSelected(index)}
                            >
                                {option}
                                {isWrong && <span className={styles.srOnly}> (alternativa descartada)</span>}
                            </button>
                        )
                    })}
                </div>
            )}

            {view.lastAttemptWrong && !view.solved && (
                <p ref={feedbackRef} tabIndex={-1} role="alert" className={styles.feedback}>
                    {isNumeric
                        ? 'Ainda não. Confira a conta e tente de novo.'
                        : 'Ainda não. Essa alternativa foi descartada, escolha outra.'}
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
                    <Button onClick={handleSubmit} disabled={!canSubmit}>
                        Responder
                    </Button>
                </div>
            )}
        </section>
    )
}
