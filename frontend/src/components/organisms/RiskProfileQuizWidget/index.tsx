import { useState } from 'react'
import { PROFILE_LABEL, QUIZ_QUESTIONS, riskProfileFromAnswers } from '../../../features/lessons/widgets/riskMath'
import type { RiskProfile } from '../../../features/lessons/widgets/riskMath'
import type { RiskProfileQuizWidgetProps } from './types'
import styles from '../LessonWidget/widgetControls.module.css'

export type { RiskProfileQuizWidgetProps } from './types'

const PROFILE_TEXT: Record<RiskProfile, string> = {
    conservative:
        'Você prioriza proteger o que tem. Costuma combinar com investimentos de baixa oscilação e liquidez, aceitando retorno menor.',
    moderate:
        'Você aceita alguma oscilação em troca de crescer mais. Costuma combinar uma base segura com uma parte em investimentos que oscilam.',
    aggressive:
        'Você tolera quedas fortes em busca de crescimento no longo prazo. Mesmo assim, precisa de reserva e de um horizonte longo.',
}

// Widget `risk-profile-quiz` (RC.3.4h): seis perguntas somam pontos e levam a um perfil. Duas
// respostas limitam o resultado: precisar do dinheiro em menos de um ano e não ter reserva. É um
// exemplo para entender a ideia de perfil, e não o questionário que uma corretora aplica.
export function RiskProfileQuizWidget(_props: RiskProfileQuizWidgetProps) {
    const [answers, setAnswers] = useState<Record<string, 1 | 2 | 3>>({})
    const done = QUIZ_QUESTIONS.every((q) => answers[q.id] !== undefined)
    const result = done ? riskProfileFromAnswers(answers) : null

    return (
        <div className={styles.root}>
            {QUIZ_QUESTIONS.map((question, index) => (
                <fieldset key={question.id} className={styles.productItem}>
                    <legend className={styles.headline}>
                        {index + 1}. {question.prompt}
                    </legend>
                    <div className={styles.presets} role="group" aria-label={question.prompt}>
                        {question.options.map((option) => (
                            <button
                                key={option.label}
                                type="button"
                                className={styles.preset}
                                aria-pressed={answers[question.id] === option.points}
                                onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: option.points }))}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </fieldset>
            ))}
            <div className={styles.result} aria-live="polite">
                {result ? (
                    <>
                        <p className={styles.headline}>
                            Perfil {PROFILE_LABEL[result.profile].toLowerCase()} ({result.score} de {result.maxScore} pontos).
                        </p>
                        <p>{PROFILE_TEXT[result.profile]}</p>
                        {result.capped && (
                            <p>
                                Sua pontuação pedia um perfil mais ousado, mas precisar do dinheiro cedo ou não ter reserva limita o risco
                                que você aguenta. A capacidade de risco pesa mais que a vontade.
                            </p>
                        )}
                        <button type="button" className={styles.preset} onClick={() => setAnswers({})}>
                            Refazer
                        </button>
                    </>
                ) : (
                    <p>Responda as {QUIZ_QUESTIONS.length} perguntas para ver o perfil.</p>
                )}
                <p>Exemplo para entender a ideia de perfil. A corretora aplica o seu próprio questionário.</p>
            </div>
        </div>
    )
}

export function riskProfileQuizSummary(_props: RiskProfileQuizWidgetProps): string {
    return `Questionário de perfil de investidor com ${QUIZ_QUESTIONS.length} perguntas (prazo, reação a uma queda, objetivo, experiência, renda e reserva): soma os pontos e mostra o perfil conservador, moderado ou arrojado, com a explicação de quando a capacidade de risco limita o resultado.`
}
