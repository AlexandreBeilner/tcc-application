import { useNavigate } from 'react-router-dom'
import { Card } from '../../atoms/Card'
import type { ResumeLessonCardProps } from './types'
import styles from './index.module.css'

export type { ResumeLessonCardProps } from './types'

// Primeira lição `available` (já ordenada por `sortOrder` pelo backend,
// `.docs/backend/lessons.md`) — mesma noção de "próximo passo" da trilha.
// Leva direto pra `/trilha/:id` (3.2 Lição, tarefa 6.4) desde que essa rota
// passou a existir — antes disso levava só pra `/trilha`.
export function ResumeLessonCard({ lessons }: ResumeLessonCardProps) {
    const navigate = useNavigate()
    const nextLesson = lessons.find((lesson) => lesson.status === 'available')

    if (!nextLesson) return null

    const isInProgress = nextLesson.currentStep > 0

    return (
        <Card accent className={styles.cardLayout} onClick={() => navigate(`/trilha/${nextLesson.id}`)}>
            <span className={styles.eyebrow}>{isInProgress ? 'Retomar lição' : 'Próxima lição'}</span>
            <span className={styles.title}>{nextLesson.title}</span>
            <span className={styles.track}>{nextLesson.trackName}</span>
        </Card>
    )
}
