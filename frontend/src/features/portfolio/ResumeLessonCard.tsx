import { useNavigate } from 'react-router-dom'
import type { Lesson } from '../../services/lessons'
import styles from './ResumeLessonCard.module.css'

interface ResumeLessonCardProps {
    lessons: Lesson[]
}

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
        <button type="button" className={styles.card} onClick={() => navigate('/trilha')}>
            <span className={styles.eyebrow}>{isInProgress ? 'Retomar lição' : 'Próxima lição'}</span>
            <span className={styles.title}>{nextLesson.title}</span>
            <span className={styles.track}>{nextLesson.trackName}</span>
        </button>
    )
}
