import { Link } from 'react-router-dom'
import type { DiarioNextStepProps } from './types'
import styles from './index.module.css'

export type { DiarioNextStepProps } from './types'

// Próximo passo depois do último cartão do Diário (DI.4.2): continuar a lição em andamento ou, sem
// lição disponível, olhar o mercado. Mesma noção de "próxima lição" do `ResumeLessonCard` (a primeira
// `available`), então nunca leva a lição bloqueada.
export function DiarioNextStep({ lessons }: DiarioNextStepProps) {
    const lesson = lessons.find((candidate) => candidate.status === 'available')

    return (
        <aside className={styles.box} aria-label="Próximo passo">
            <p className={styles.title}>Qual é o próximo passo?</p>
            {lesson ? (
                <Link to={`/trilha/${lesson.id}`} className={styles.link}>
                    {lesson.currentStep > 0 ? 'Retomar a lição' : 'Começar a próxima lição'}: {lesson.title}
                </Link>
            ) : (
                <Link to="/mercado" className={styles.link}>
                    Ver o mercado
                </Link>
            )}
        </aside>
    )
}
