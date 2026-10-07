import { useState } from 'react'
import type { RatingGrade, RatingRulerWidgetProps } from './types'
import styles from '../LessonWidget/widgetControls.module.css'

export type { RatingGrade, RatingRulerWidgetProps } from './types'

interface RatingInfo {
    grade: RatingGrade
    investmentGrade: boolean
    meaning: string
}

// Escala usada pelas agências de classificação de risco (convenção de mercado,
// sem texto de lei): de AAA, a menor chance de calote, a D, calote já
// ocorrido. Cada agência tem a sua escala e acrescenta sinais (+ e -) e o "br"
// da escala nacional; o corte entre grau de investimento e especulativo fica
// entre BBB e BB.
export const RATING_SCALE: RatingInfo[] = [
    { grade: 'AAA', investmentGrade: true, meaning: 'Capacidade altíssima de pagar o que deve. O menor risco de crédito da escala.' },
    { grade: 'AA', investmentGrade: true, meaning: 'Capacidade muito forte de pagar, um degrau abaixo do topo.' },
    { grade: 'A', investmentGrade: true, meaning: 'Capacidade forte de pagar, mas mais sensível a piora da economia.' },
    { grade: 'BBB', investmentGrade: true, meaning: 'Capacidade adequada de pagar. É o último degrau do grau de investimento.' },
    { grade: 'BB', investmentGrade: false, meaning: 'Já é grau especulativo: o pagamento depende de o cenário continuar favorável.' },
    { grade: 'B', investmentGrade: false, meaning: 'Vulnerável: qualquer piora de cenário ameaça o pagamento.' },
    { grade: 'CCC', investmentGrade: false, meaning: 'Muito vulnerável: o pagamento depende de condições favoráveis para acontecer.' },
    { grade: 'CC', investmentGrade: false, meaning: 'Calote é altamente provável.' },
    { grade: 'C', investmentGrade: false, meaning: 'Calote é praticamente certo.' },
    { grade: 'D', investmentGrade: false, meaning: 'O pagamento já não foi feito: calote ocorrido.' },
]

// Widget `rating-ruler` (RC.3.4b): a régua do rating, de AAA a D, com a linha
// que separa grau de investimento de grau especulativo. O corte também vem
// escrito (borda tracejada e texto), nunca só por cor.
export function RatingRulerWidget({ highlight }: RatingRulerWidgetProps) {
    const [selected, setSelected] = useState<RatingGrade>(highlight)
    const info = RATING_SCALE.find((item) => item.grade === selected) ?? RATING_SCALE[0]

    return (
        <div className={styles.root}>
            <ol className={styles.ruler} aria-label="Escala de rating, de AAA a D">
                {RATING_SCALE.map((item) => (
                    <li key={item.grade}>
                        <button
                            type="button"
                            className={`${styles.rulerMark} ${item.investmentGrade ? '' : styles.rulerMarkSpeculative}`}
                            aria-pressed={selected === item.grade}
                            onClick={() => setSelected(item.grade)}
                        >
                            {item.grade}
                        </button>
                    </li>
                ))}
            </ol>
            <div className={styles.result} aria-live="polite">
                <p className={styles.headline}>
                    Nota {info.grade}: {info.investmentGrade ? 'grau de investimento' : 'grau especulativo'}
                </p>
                <p>{info.meaning}</p>
                <p>
                    Borda contínua é grau de investimento, tracejada é grau especulativo. Notas mais baixas costumam pagar juros maiores,
                    para compensar o risco.
                </p>
            </div>
        </div>
    )
}

export function ratingRulerSummary({ highlight }: RatingRulerWidgetProps): string {
    return `Régua de rating com 10 notas, de AAA a D, começando na nota ${highlight}: AAA a BBB são grau de investimento, BB a D são grau especulativo, e cada nota explica o risco de calote que representa.`
}
