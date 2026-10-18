import { useNavigate } from 'react-router-dom'
import { useFirstActionResult } from '../../../features/onboarding/useFirstActionResult'
import { FIRST_ACTION_LESSON_CODE, FIRST_ACTION_TICKER } from '../../../features/onboarding/firstAction'
import { useLessonsQuery } from '../../../features/lessons/useLessonsQuery'
import { formatCurrency } from '../../../features/portfolio/format'
import { Button } from '../../atoms/Button'
import styles from './index.module.css'

const percentFormatter = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: 'exceptZero' })

// Resultado da primeira ação do onboarding (OB.1.2, OP2), na tela da trilha (OA1: o Portfólio só abre
// na lição 0.1, então o cartão fica aqui). Só aparece quando o roteiro já andou; antes disso a pessoa já
// foi avisada de que o preço leva um dia para mexer.
export function FirstActionResultCard() {
    const navigate = useNavigate()
    const { result, dismiss } = useFirstActionResult()
    const lessonsQuery = useLessonsQuery()

    if (!result) return null

    const lesson = lessonsQuery.data?.lessons.find((candidate) => candidate.code === FIRST_ACTION_LESSON_CODE)
    const change = percentFormatter.format(result.changeRatio * 100)
    const direction = result.changeRatio > 0 ? 'subiu' : 'caiu'

    return (
        <section className={styles.card} aria-label="Resultado da sua primeira ação">
            <span className={styles.eyebrow}>Sua primeira ação</span>
            <span className={`${styles.change} tabular-nums`}>{change}%</span>
            <p className={styles.body}>
                A ação de treino {FIRST_ACTION_TICKER} {direction}: você pagou {formatCurrency(result.averagePrice)} e hoje ela vale{' '}
                {formatCurrency(result.currentPrice)}. Quer saber por que o preço mexe?
            </p>
            <div className={styles.actions}>
                <Button onClick={() => navigate(lesson ? `/trilha/${lesson.id}` : '/trilha')}>Ver por que o preço mexe</Button>
                <Button variant="secondary" onClick={dismiss}>
                    Entendi
                </Button>
            </div>
        </section>
    )
}
