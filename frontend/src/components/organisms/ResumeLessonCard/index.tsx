import { useNavigate } from 'react-router-dom'
import { Card } from '../../atoms/Card'
import type { ResumeLessonCardProps } from './types'
import styles from './index.module.css'

export type { ResumeLessonCardProps } from './types'

// Primeira lição `available` (já ordenada por `sortOrder` pelo backend,
// `.docs/backend/lessons.md`) — mesma noção de "próximo passo" da trilha.
// Leva pra `/trilha` (3.1 Mapa da Trilha), não direto pra 3.2 Lição: a
// tela de lição em si é a tarefa 6.4, ainda não implementada — sem rota
// própria por lição hoje, `/trilha` é o melhor destino disponível.
export function ResumeLessonCard({ lessons }: ResumeLessonCardProps) {
    const navigate = useNavigate()
    const nextLesson = lessons.find((lesson) => lesson.status === 'available')

    if (!nextLesson) return null

    const isInProgress = nextLesson.currentStep > 0

    return (
        <Card accent className={styles.cardLayout} onClick={() => navigate('/trilha')}>
            <span className={styles.eyebrow}>{isInProgress ? 'Retomar lição' : 'Próxima lição'}</span>
            <span className={styles.title}>{nextLesson.title}</span>
            <span className={styles.track}>{nextLesson.trackName}</span>
        </Card>
    )
}
