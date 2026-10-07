import { useState } from 'react'
import { BIAS_LABEL, BIAS_SCENARIOS, countPlanChoices } from '../../../features/lessons/widgets/biasMath'
import type { BehaviorBiasQuizWidgetProps } from './types'
import styles from '../LessonWidget/widgetControls.module.css'

export type { BehaviorBiasQuizWidgetProps } from './types'

// Widget `behavior-bias-quiz` (RC.4.9): quatro cenários curtos, três reações cada. Ao escolher,
// o widget nomeia o viés (ou diz que seguiu o plano) e explica o custo. As escolhas ficam só no
// estado do widget, e dá para refazer.
export function BehaviorBiasQuizWidget(_props: BehaviorBiasQuizWidgetProps) {
    const [choices, setChoices] = useState<Record<string, number>>({})
    const answered = BIAS_SCENARIOS.filter((s) => choices[s.id] !== undefined).length
    const done = answered === BIAS_SCENARIOS.length

    return (
        <div className={styles.root}>
            {BIAS_SCENARIOS.map((scenario, index) => {
                const chosen = choices[scenario.id]
                const reaction = chosen !== undefined ? scenario.reactions[chosen] : null
                return (
                    <fieldset key={scenario.id} className={styles.productItem}>
                        <legend className={styles.headline}>
                            {index + 1}. {scenario.prompt}
                        </legend>
                        <div className={styles.presets} role="group" aria-label={scenario.prompt}>
                            {scenario.reactions.map((option, optionIndex) => (
                                <button
                                    key={option.label}
                                    type="button"
                                    className={styles.preset}
                                    aria-pressed={chosen === optionIndex}
                                    onClick={() => setChoices((prev) => ({ ...prev, [scenario.id]: optionIndex }))}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                        {reaction && (
                            <p aria-live="polite">
                                <strong>{reaction.bias ? BIAS_LABEL[reaction.bias] : 'Seguiu o plano'}.</strong> {reaction.feedback}
                            </p>
                        )}
                    </fieldset>
                )
            })}
            <div className={styles.result} aria-live="polite">
                {done ? (
                    <>
                        <p className={styles.headline}>
                            Você seguiu o plano em {countPlanChoices(choices)} de {BIAS_SCENARIOS.length} situações.
                        </p>
                        <button type="button" className={styles.preset} onClick={() => setChoices({})}>
                            Refazer
                        </button>
                    </>
                ) : (
                    <p>
                        Responda as {BIAS_SCENARIOS.length} situações ({answered} de {BIAS_SCENARIOS.length}).
                    </p>
                )}
                <p>Cenários de exemplo para reconhecer vieses. Não são recomendação de investimento.</p>
            </div>
        </div>
    )
}

export function behaviorBiasQuizSummary(_props: BehaviorBiasQuizWidgetProps): string {
    return `Quiz com ${BIAS_SCENARIOS.length} situações de investimento (queda de 20%, preço de compra, três acertos seguidos e pressa), cada uma com três reações. Ao escolher, mostra o viés envolvido (aversão à perda, ancoragem ou autoconfiança excessiva) ou que a reação seguiu um plano, e no fim conta quantas vezes o plano foi seguido.`
}
