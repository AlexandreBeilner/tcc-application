import { useId, useState } from 'react'
import { Button } from '../../atoms/Button'
import { StreakSeal } from '../../molecules/StreakSeal'
import { ShareResultButton } from '../ShareResultButton'
import { buildEstimateCard, buildEstimateMessage } from '../../../features/lessons/shareResult'
import {
    estimateMessage,
    formatEstimateValue,
    parseEstimateInput,
    scalePosition,
    snapToRange,
    stepByKey,
} from '../../../features/lessons/estimateScale'
import type { EstimateCheckpointProps } from './types'
import styles from './index.module.css'

export type { EstimateCheckpointProps } from './types'

// Mantém o rótulo da marca dentro da régua mesmo quando o valor cai numa ponta.
const labelLeft = (position: number) => Math.min(88, Math.max(12, position))

// Pergunta de estimativa (LJ.2.2, bloco `check` com `kind: 'estimate'`): previsão, não prova (LJ-D1).
// A pessoa chuta num controle deslizante (ou digitando), sempre avança e vê duas marcas na régua,
// "Seu chute" e "O valor real", com a faixa de tolerância sombreada. Longe do valor nunca é erro:
// o tom é de descoberta. O controle começa na ponta mínima: o meio da régua costuma ficar perto da resposta e induziria o chute. O valor real só chega do servidor depois do chute.
export function EstimateCheckpoint({ block, view, pending, error, isReview, lessonTitle, onSubmit }: EstimateCheckpointProps) {
    const { min, max, step, unit } = block.range
    const range = { min, max, step }
    const inputId = useId()
    const [value, setValue] = useState(min)
    const [text, setText] = useState(String(value))
    const [touched, setTouched] = useState(false)
    const typed = parseEstimateInput(text, range)
    const canSubmit = !view.solved && !pending && touched && typed !== undefined

    function choose(next: number) {
        setValue(next)
        setText(String(next))
        setTouched(true)
    }

    function handleText(raw: string) {
        setText(raw)
        setTouched(true)
        const parsed = parseEstimateInput(raw, range)
        if (parsed !== undefined) setValue(snapToRange(parsed, range))
    }

    function handleSubmit() {
        if (typed !== undefined) onSubmit({ value: typed })
    }

    const result = view.estimate

    return (
        <section className={styles.check} aria-label="Pergunta">
            <span className={styles.eyebrow}>Pergunta</span>
            <p className={styles.prompt}>{block.prompt}</p>

            {!result && (
                <div className={styles.control}>
                    <p className={styles.current} aria-hidden="true">
                        {formatEstimateValue(value, unit)}
                    </p>
                    <input
                        type="range"
                        className={styles.slider}
                        aria-label="Seu chute"
                        aria-valuetext={formatEstimateValue(value, unit)}
                        min={min}
                        max={max}
                        step={step}
                        value={value}
                        disabled={view.solved}
                        data-lesson-widget=""
                        onChange={(event) => choose(Number(event.target.value))}
                        onKeyDown={(event) => {
                            const next = stepByKey(value, event.key, range)
                            if (next !== undefined) {
                                event.preventDefault()
                                choose(next)
                            }
                        }}
                    />
                    <div className={styles.ends} aria-hidden="true">
                        <span>{formatEstimateValue(min, unit)}</span>
                        <span>{formatEstimateValue(max, unit)}</span>
                    </div>
                    <label className={styles.typed} htmlFor={inputId}>
                        Ou digite o valor
                        <input
                            id={inputId}
                            type="text"
                            inputMode="decimal"
                            className={styles.field}
                            value={text}
                            aria-invalid={touched && typed === undefined}
                            onChange={(event) => handleText(event.target.value)}
                        />
                    </label>
                    {touched && typed === undefined && (
                        <p role="alert" className={styles.hint}>
                            Use um valor entre {formatEstimateValue(min, unit)} e {formatEstimateValue(max, unit)}.
                        </p>
                    )}
                </div>
            )}

            {result && (
                <div role="status" className={styles.solved}>
                    <p className={styles.verdict}>{estimateMessage(result.band)}</p>
                    <div className={styles.ruler} aria-hidden="true">
                        <span className={styles.markLabelTop} style={{ left: `${labelLeft(scalePosition(result.guess, range))}%` }}>
                            Seu chute
                        </span>
                        <div className={styles.track}>
                            <span
                                className={styles.band}
                                style={{
                                    left: `${scalePosition(result.low, range)}%`,
                                    width: `${scalePosition(result.high, range) - scalePosition(result.low, range)}%`,
                                }}
                            />
                            <span className={styles.guessMark} style={{ left: `${scalePosition(result.guess, range)}%` }} />
                            <span className={styles.realMark} style={{ left: `${scalePosition(result.value, range)}%` }} />
                        </div>
                        <span className={styles.markLabelBottom} style={{ left: `${labelLeft(scalePosition(result.value, range))}%` }}>
                            O valor real
                        </span>
                    </div>
                    <dl className={styles.legend}>
                        <div>
                            <dt>Seu chute</dt>
                            <dd>{formatEstimateValue(result.guess, unit)}</dd>
                        </div>
                        <div>
                            <dt>O valor real</dt>
                            <dd>{formatEstimateValue(result.value, unit)}</dd>
                        </div>
                        <div>
                            <dt>Na mosca vai de</dt>
                            <dd>
                                {formatEstimateValue(Math.round(result.low * 100) / 100, unit)} a{' '}
                                {formatEstimateValue(Math.round(result.high * 100) / 100, unit)}
                            </dd>
                        </div>
                    </dl>
                    {view.explanation && <p className={styles.explanation}>{view.explanation}</p>}
                    {view.streakMilestone && !isReview && <StreakSeal milestone={view.streakMilestone} />}
                    <ShareResultButton
                        message={buildEstimateMessage({ guess: result.guess, value: result.value, unit })}
                        card={buildEstimateCard(lessonTitle ?? 'Estimativa', { guess: result.guess, value: result.value, unit })}
                    />
                </div>
            )}

            {view.solved && !result && (
                <div role="status" className={styles.solved}>
                    <p className={styles.explanation}>Você já fez esta estimativa.</p>
                </div>
            )}

            {error && (
                <p role="alert" className={styles.hint}>
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
