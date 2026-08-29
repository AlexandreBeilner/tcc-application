import type { LessonNodeProps } from './types'
import styles from './index.module.css'

export type { LessonNodeProps } from './types'

const STATUS_ICON: Record<LessonNodeProps['lesson']['status'], string> = {
    completed: '✓',
    available: '●',
    locked: '🔒',
}

// Nó de progressão da trilha (inventário 3.1) — estados seguem literalmente
// `.claude/identidade-visual-tokens.md` seção 2.5 (bloqueado/disponível/
// concluído), fixados no mockup da tarefa 6.4. Componente pensado pra ser
// reaproveitado por outras listas de progressão (ex: cards de missão, 7.3),
// por isso não depende de nada específico de trilha além de `Lesson`.
export function LessonNode({ lesson, onClick }: LessonNodeProps) {
    const meta =
        lesson.status === 'completed'
            ? 'Concluída'
            : lesson.status === 'available'
              ? 'Disponível'
              : lesson.unlocksDescription
                ? `Bloqueada — libera ${lesson.unlocksDescription}`
                : 'Bloqueada'

    return (
        <button
            type="button"
            className={[styles.node, styles[lesson.status]].join(' ')}
            onClick={onClick}
            aria-label={`${lesson.title} — ${meta}`}
        >
            <span className={styles.badge} aria-hidden="true">
                {STATUS_ICON[lesson.status]}
            </span>
            <span className={styles.body}>
                <span className={styles.title}>{lesson.title}</span>
                <span className={styles.meta}>{meta}</span>
            </span>
        </button>
    )
}
