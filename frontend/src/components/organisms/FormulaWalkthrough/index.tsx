import { Lightbulb } from 'lucide-react'
import type { FormulaWalkthroughProps } from './types'
import styles from './index.module.css'

export type { FormulaWalkthroughProps } from './types'

export function formulaWalkthroughSummary({ intro, items, note }: FormulaWalkthroughProps): string {
    const parts = items.map((item) => `${item.label}: ${item.formula}. Com os números: ${item.numbers}, ou seja, ${item.result}.`)
    return [intro, ...parts, note].filter(Boolean).join(' ')
}

// Fórmula passo a passo: cada item mostra a fórmula com letras, a mesma conta
// com os números e o resultado destacado, tudo no mesmo cartão. Substitui a
// sequência "texto com a fórmula, depois outro cartão com os valores". Sem
// cores de ganho/perda (identidade-visual-tokens.md §2.3): o resultado se
// destaca por peso e tamanho.
export function FormulaWalkthrough({ intro, items, note }: FormulaWalkthroughProps) {
    return (
        <div className={styles.root}>
            {intro && <p className={styles.intro}>{intro}</p>}
            <ol className={styles.items}>
                {items.map((item) => (
                    <li key={item.label} className={styles.item}>
                        <p className={styles.label}>{item.label}</p>
                        <code className={styles.formula}>{item.formula}</code>
                        {item.legend && <p className={styles.legend}>{item.legend}</p>}
                        <div className={styles.numbers}>
                            <span className={styles.numbersLabel}>Com os números</span>
                            <code className={styles.numbersLine}>{item.numbers}</code>
                            <strong className={styles.result}>{item.result}</strong>
                        </div>
                    </li>
                ))}
            </ol>
            {note && (
                <p className={styles.note}>
                    <Lightbulb size={16} aria-hidden="true" />
                    {note}
                </p>
            )}
        </div>
    )
}
