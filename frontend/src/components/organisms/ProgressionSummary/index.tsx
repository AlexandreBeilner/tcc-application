import { Flame } from 'lucide-react'
import type { ProgressionSummaryProps } from './types'
import styles from './index.module.css'

export type { ProgressionSummaryProps } from './types'

// XP/nível (`GET /me/progression`) e streak (`GET /me/streak`) — dois
// endpoints distintos por decisão do backlog (tarefa 6.3), mesmo os dois
// campos de streak existindo em ambas as respostas. Ícone de chama no
// streak (identidade-visual-padroes.md §9) — teatro de recompensa contido
// no ícone, não em cor nova: os dois badges continuam no mesmo dourado.
export function ProgressionSummary({ progression, streak, nextUnlock }: ProgressionSummaryProps) {
    return (
        <div className={styles.container}>
            <div className={styles.summary}>
                <div className={styles.badge}>
                    <span className={styles.badgeValue}>Nível {progression.level}</span>
                    <span className={styles.badgeDetail}>{progression.xp} XP</span>
                </div>
                <div className={styles.badge}>
                    <span className={styles.badgeValue}>
                        <Flame size={16} strokeWidth={2} fill="currentColor" aria-hidden="true" />
                        {streak.currentStreak}
                    </span>
                    <span className={styles.badgeDetail}>{streak.currentStreak === 1 ? 'dia seguido' : 'dias seguidos'}</span>
                </div>
            </div>

            {nextUnlock && (
                <p className={styles.nextUnlock}>
                    Faltam {nextUnlock.lessonsRemaining} {nextUnlock.lessonsRemaining === 1 ? 'lição' : 'lições'} pra:{' '}
                    <strong>{nextUnlock.description}</strong>
                </p>
            )}
        </div>
    )
}
