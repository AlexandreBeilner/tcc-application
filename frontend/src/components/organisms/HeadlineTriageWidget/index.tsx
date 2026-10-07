import { useState } from 'react'
import type { HeadlineTriageWidgetProps } from './types'
import styles from '../LessonWidget/widgetControls.module.css'

export type { HeadlineTriageWidgetProps } from './types'

interface Headline {
    id: string
    text: string
    question: string
    options: string[]
    answer: number
    explanation: string
}

// Manchetes de exemplo, escritas para a lição (nenhuma é notícia real). O que
// importa em cada uma é o canal pelo qual a notícia chega ao preço e se ela é
// surpresa ou já estava esperada.
export const HEADLINES: Headline[] = [
    {
        id: 'selic',
        text: 'Banco Central eleva a Selic em 0,50 ponto.',
        question: 'Quem tende a sofrer mais?',
        options: ['Empresa com muita dívida', 'Empresa sem dívida', 'Ninguém é afetado'],
        answer: 0,
        explanation: 'Juros mais altos encarecem a dívida, então pesam mais em quem deve muito.',
    },
    {
        id: 'lucro',
        text: 'Empresa divulga lucro de R$ 1,00 por ação. O mercado esperava R$ 1,20.',
        question: 'Qual é a reação mais provável do preço?',
        options: ['Cair, porque ficou abaixo do esperado', 'Subir, porque houve lucro', 'Ficar igual'],
        answer: 0,
        explanation: 'O preço já embute o que se espera. O que move é a surpresa: aqui, lucro abaixo do esperado.',
    },
    {
        id: 'safra',
        text: 'Quebra de safra reduz a oferta de grãos no país.',
        question: 'Quem é afetado mais diretamente?',
        options: ['Uma mineradora', 'Empresas do agronegócio', 'Todas as empresas, igualmente'],
        answer: 1,
        explanation: 'Notícia setorial pesa sobre o setor que ela toca. Uma mineradora só sente de forma indireta.',
    },
    {
        id: 'fonte',
        text: 'Uma postagem em rede social promete "ação que vai dobrar esta semana".',
        question: 'Qual é a melhor atitude?',
        options: ['Comprar antes que suba', 'Procurar o fato relevante ou o comunicado da empresa', 'Repassar para os amigos'],
        answer: 1,
        explanation: 'A fonte primária é o que a empresa divulga ao mercado. Promessa de ganho garantido é sinal de alerta.',
    },
]

// Widget `headline-triage` (RC.3.4e): quatro manchetes de exemplo, uma pergunta
// por manchete, e a explicação aparece depois da resposta.
export function HeadlineTriageWidget(_props: HeadlineTriageWidgetProps) {
    const [answers, setAnswers] = useState<Record<string, number>>({})
    const answered = Object.keys(answers).length
    const correct = HEADLINES.filter((h) => answers[h.id] === h.answer).length

    return (
        <div className={styles.root}>
            <ul className={styles.productList}>
                {HEADLINES.map((headline) => {
                    const answer = answers[headline.id]
                    return (
                        <li key={headline.id} className={styles.productItem}>
                            <p className={styles.headline}>{headline.text}</p>
                            <p>{headline.question}</p>
                            <div className={styles.presets} role="group" aria-label={headline.question}>
                                {headline.options.map((option, index) => (
                                    <button
                                        key={option}
                                        type="button"
                                        className={styles.preset}
                                        aria-pressed={answer === index}
                                        onClick={() => setAnswers((prev) => ({ ...prev, [headline.id]: index }))}
                                    >
                                        {option}
                                    </button>
                                ))}
                            </div>
                            {answer !== undefined && (
                                <p aria-live="polite">
                                    {answer === headline.answer
                                        ? 'Certo. '
                                        : `Não é isso. O certo é: ${headline.options[headline.answer]}. `}
                                    {headline.explanation}
                                </p>
                            )}
                        </li>
                    )
                })}
            </ul>
            <div className={styles.result} aria-live="polite">
                <p>
                    {answered === 0
                        ? 'As manchetes são de exemplo. Escolha uma resposta para cada uma.'
                        : `Você acertou ${correct} de ${answered} ${answered === 1 ? 'resposta' : 'respostas'}.`}
                </p>
            </div>
        </div>
    )
}

export function headlineTriageSummary(_props: HeadlineTriageWidgetProps): string {
    return `Triagem de manchetes: ${HEADLINES.length} manchetes de exemplo (Selic, lucro abaixo do esperado, quebra de safra e promessa em rede social) para decidir quem é afetado e o que fazer, com a explicação mostrada depois da resposta.`
}
