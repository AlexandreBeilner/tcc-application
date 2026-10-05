import { useState } from 'react'
import type { WhereToKeepWidgetProps } from './types'
import styles from '../LessonWidget/widgetControls.module.css'

export type { WhereToKeepWidgetProps } from './types'

interface Product {
    name: string
    serves: boolean
    reason: string
}

// Critério do Caderno de Educação Financeira do Banco Central: a reserva fica em
// aplicação de alta liquidez e baixo risco, para o dinheiro estar lá, sem perda e
// disponível rápido.
export const WHERE_TO_KEEP_PRODUCTS: Product[] = [
    { name: 'Tesouro Selic', serves: true, reason: 'Alta liquidez e baixa oscilação de preço: o valor só sobe.' },
    { name: 'Ações', serves: false, reason: 'O preço oscila e pode estar em queda justo quando você precisar vender.' },
    { name: 'CDB com liquidez diária', serves: true, reason: 'Dá para resgatar quando precisar, e o FGC cobre dentro do limite.' },
    {
        name: 'Tesouro Prefixado de longo prazo',
        serves: false,
        reason: 'Vender antes do vencimento pode dar prejuízo, por causa da marcação a mercado.',
    },
    { name: 'LCI com carência', serves: false, reason: 'Durante a carência o dinheiro não pode ser resgatado.' },
    { name: 'Poupança', serves: true, reason: 'Liquidez imediata e sem oscilação, ainda que o rendimento costume ser menor.' },
]

type Answers = Record<string, boolean>

// Widget `where-to-keep` (RC.4.6): para cada produto o aluno diz se serve ou não
// para a reserva de emergência, e o motivo aparece depois da resposta, certa ou
// errada. Botões em vez de arrastar, para funcionar em teclado e toque.
export function WhereToKeepWidget(_props: WhereToKeepWidgetProps) {
    const [answers, setAnswers] = useState<Answers>({})
    const answered = Object.keys(answers).length
    const correct = WHERE_TO_KEEP_PRODUCTS.filter((p) => answers[p.name] === p.serves).length

    return (
        <div className={styles.root}>
            <ul className={styles.productList}>
                {WHERE_TO_KEEP_PRODUCTS.map((product) => {
                    const answer = answers[product.name]
                    const done = answer !== undefined
                    return (
                        <li key={product.name} className={styles.productItem}>
                            <p className={styles.headline}>{product.name}</p>
                            <div className={styles.presets} role="group" aria-label={`${product.name} serve para a reserva?`}>
                                {[true, false].map((value) => (
                                    <button
                                        key={String(value)}
                                        type="button"
                                        className={styles.preset}
                                        aria-pressed={answer === value}
                                        onClick={() => setAnswers((prev) => ({ ...prev, [product.name]: value }))}
                                    >
                                        {value ? 'Serve' : 'Não serve'}
                                    </button>
                                ))}
                            </div>
                            {done && (
                                <p aria-live="polite">
                                    {answer === product.serves ? 'Certo. ' : 'Não é isso. '}
                                    {product.serves ? 'Serve: ' : 'Não serve: '}
                                    {product.reason}
                                </p>
                            )}
                        </li>
                    )
                })}
            </ul>
            <div className={styles.result} aria-live="polite">
                <p>
                    {answered === 0
                        ? 'Escolha "Serve" ou "Não serve" para cada produto.'
                        : `Você acertou ${correct} de ${answered} ${answered === 1 ? 'resposta' : 'respostas'}.`}
                </p>
            </div>
        </div>
    )
}

export function whereToKeepSummary(_props: WhereToKeepWidgetProps): string {
    return `Lista de ${WHERE_TO_KEEP_PRODUCTS.length} produtos (${WHERE_TO_KEEP_PRODUCTS.map((p) => p.name).join(', ')}): para cada um você marca se serve ou não para a reserva de emergência e vê o motivo.`
}
