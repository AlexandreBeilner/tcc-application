import { Check, Circle } from 'lucide-react'
import { Locked } from '../../atoms/Locked'
import type { LessonNodeProps } from './types'
import styles from './index.module.css'

export type { LessonNodeProps, LessonNodeStatus } from './types'

const STATUS_ICON: Record<'completed' | 'available', typeof Check> = {
    completed: Check,
    available: Circle,
}

// Nó de progressão (inventário 3.1) — estados seguem literalmente
// `.claude/identidade-visual-tokens.md` seção 2.5 (bloqueado/disponível/
// concluído), fixados no mockup da tarefa 6.4. Generalizado na tarefa 6.8:
// recebe `title`/`meta` já prontos do chamador em vez de um `Lesson`
// inteiro — reaproveitado por `DailyMissionsList` (7.3, mesma linguagem
// visual de progressão pras missões diárias), não só pela Trilha. Estado
// `locked` usa o átomo `Locked` (tarefa K.1) em vez do `Lock` solto que o
// gráfico horizontal antigo do Mapa da Trilha também reimplementava.
export function LessonNode({ status, title, meta, onClick }: LessonNodeProps) {
    const StatusIcon = status === 'locked' ? null : STATUS_ICON[status]

    return (
        <button type="button" className={[styles.node, styles[status]].join(' ')} onClick={onClick} aria-label={`${title}: ${meta}`}>
            <span className={styles.badge} aria-hidden="true">
                {StatusIcon ? (
                    <StatusIcon size={16} strokeWidth={2} fill={status === 'available' ? 'currentColor' : 'none'} />
                ) : (
                    <Locked size={16} />
                )}
            </span>
            <span className={styles.body}>
                <span className={styles.title}>{title}</span>
                <span className={styles.meta}>{meta}</span>
            </span>
        </button>
    )
}
