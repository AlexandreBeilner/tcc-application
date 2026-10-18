import { useState } from 'react'
import { featureUnlockCtaFor } from '../../../features/lessons/featureUnlockCta'
import { splitIntoCards } from '../../../features/lessons/splitIntoCards'
import { EMBEDDED_WIDGET_TYPES } from '../../../features/admin/lessonDraft'
import type { AdminLessonContent } from '../../../services/admin'
import { Button } from '../../atoms/Button'
import { LessonCardBody, LessonCardDots } from '../../molecules/LessonCardText'
import type { LessonRef } from '../../molecules/LessonCardText'
import styles from './index.module.css'

// Mesmos rótulos do player (LJ.1.2): o Cenário não tem etiqueta no cartão, só nome de aba aqui.
const STEPS = ['Cenário', 'Sua aposta', 'O que acontece', 'Lição concluída'] as const

interface LessonPreviewProps {
    content: AdminLessonContent
    // Lições existentes, só pra resolver `{{ref:X.Y}}` em link.
    lessons: LessonRef[]
}

// Pré-visualização da lição como o usuário a vê (N.23): o texto de cada passo passa pelo mesmo código da
// tela da lição (cartões separados por linha em branco, `[revelar]`, glossário e referência a outra lição) e
// os cartões avançam um a um. Os widgets que dependem de dados ao vivo (calculadora, comparador, indicador)
// aparecem como um aviso do que entra ali, não funcionando. A aposta pode ser clicada pra ver o selo de
// acerto ou erro da Revelação.
export function LessonPreview({ content, lessons }: LessonPreviewProps) {
    const [step, setStep] = useState(0)
    const [subStep, setSubStep] = useState(0)
    const [revealed, setRevealed] = useState<Set<number>>(new Set())
    const [selected, setSelected] = useState<number | null>(null)

    const scenario = splitIntoCards(content.scenario_text)
    const prompt = splitIntoCards(content.micro_decision_prompt)
    const revelation = splitIntoCards(content.revelation_text)
    const cardsByStep = [scenario, prompt, revelation]
    const cards = cardsByStep[step] ?? []
    const card = cards[Math.min(subStep, Math.max(cards.length - 1, 0))]
    const isLastCard = subStep >= cards.length - 1

    const options = content.micro_decision_options
    const correct = content.micro_decision_correct_option
    const usesWidget = EMBEDDED_WIDGET_TYPES.includes(content.micro_decision_type)
    const hasBet = options !== null && correct !== null && !usesWidget
    const featureCta = content.unlocks_asset_ticker ? null : featureUnlockCtaFor(content.unlocks_keys)

    function goToStep(next: number) {
        setStep(next)
        setSubStep(0)
        setRevealed(new Set())
    }

    return (
        <section className={styles.root} aria-label="Pré-visualização da lição">
            <div className={styles.steps} role="tablist" aria-label="Passos da lição">
                {STEPS.map((label, index) => (
                    <button
                        key={label}
                        type="button"
                        role="tab"
                        aria-selected={step === index}
                        className={`${styles.step} ${step === index ? styles.active : ''}`}
                        onClick={() => goToStep(index)}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {step < 3 && card && (
                <div className={styles.card}>
                    {step > 0 && <span className={styles.eyebrow}>{STEPS[step]}</span>}
                    <h3 className={styles.heading}>{content.title || 'Título da lição'}</h3>

                    {step === 2 && selected !== null && hasBet && correct !== null && options !== null && (
                        <span className={selected === correct ? styles.badgeCorrect : styles.badgeAlmost}>
                            {selected === correct ? 'Você acertou' : `Quase. A resposta certa era: ${options[correct]}`}
                        </span>
                    )}

                    <LessonCardBody
                        card={card}
                        revealed={revealed.has(subStep)}
                        onReveal={() => setRevealed((current) => new Set(current).add(subStep))}
                        lessons={lessons}
                    />
                    {cards.length > 1 && <LessonCardDots total={cards.length} current={subStep} />}

                    {step === 1 && isLastCard && (
                        <>
                            {usesWidget && (
                                <p className={styles.note}>
                                    Aqui entra{' '}
                                    {content.micro_decision_type === 'growth_calculator'
                                        ? 'a calculadora de crescimento'
                                        : 'o comparador de renda fixa'}
                                    .
                                </p>
                            )}
                            {hasBet && options && (
                                <div className={styles.options} role="group" aria-label="Escolha uma opção">
                                    {options.map((option, index) => (
                                        <button
                                            key={index}
                                            type="button"
                                            aria-pressed={selected === index}
                                            className={`${styles.option} ${selected === index ? styles.selected : ''}`}
                                            onClick={() => setSelected(index)}
                                        >
                                            {option || `Opção ${index + 1} (vazia)`}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {step === 2 && isLastCard && content.micro_decision_type === 'live_indicator' && (
                        <p className={styles.note}>
                            Aqui entram os indicadores ao vivo de {content.micro_decision_asset_ticker || 'um ativo'}.
                        </p>
                    )}
                    {step === 2 && isLastCard && content.micro_decision_type === 'live_macro_indicator' && (
                        <p className={styles.note}>Aqui entram os indicadores macro ao vivo.</p>
                    )}

                    <div className={styles.cta}>
                        <Button
                            variant="secondary"
                            disabled={subStep === 0}
                            onClick={() => setSubStep((current) => Math.max(0, current - 1))}
                        >
                            Cartão anterior
                        </Button>
                        <Button disabled={isLastCard} onClick={() => setSubStep((current) => current + 1)}>
                            Próximo cartão
                        </Button>
                    </div>
                </div>
            )}

            {step === 3 && (
                <div className={`${styles.card} ${styles.unlock}`}>
                    <span className={styles.eyebrow}>{STEPS[3]}</span>
                    <h3 className={styles.heading}>{content.title || 'Título da lição'}</h3>
                    <p className={styles.body}>{content.unlocks_description || 'Você avançou mais um passo na trilha.'}</p>
                    <div className={styles.cta}>
                        <Button variant="secondary" disabled>
                            Voltar pra Trilha
                        </Button>
                        {content.unlocks_asset_ticker && <Button disabled>Comprar agora ({content.unlocks_asset_ticker})</Button>}
                        {featureCta && <Button disabled>{featureCta.label}</Button>}
                        <Button disabled>Continuar</Button>
                    </div>
                </div>
            )}
        </section>
    )
}
