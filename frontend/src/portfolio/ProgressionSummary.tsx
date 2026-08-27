import type { Progression } from '../api/gamification'
import type { Streak } from '../api/gamification'
import styles from './ProgressionSummary.module.css'

interface ProgressionSummaryProps {
  progression: Progression
  streak: Streak
}

// XP/nível (`GET /me/progression`) e streak (`GET /me/streak`) — dois
// endpoints distintos por decisão do backlog (tarefa 6.3), mesmo os dois
// campos de streak existindo em ambas as respostas.
export function ProgressionSummary({ progression, streak }: ProgressionSummaryProps) {
  return (
    <div className={styles.summary}>
      <div className={styles.badge}>
        <span className={styles.badgeValue}>Nível {progression.level}</span>
        <span className={styles.badgeDetail}>{progression.xp} XP</span>
      </div>
      <div className={styles.badge}>
        <span className={styles.badgeValue}>{streak.currentStreak}</span>
        <span className={styles.badgeDetail}>
          {streak.currentStreak === 1 ? 'dia seguido' : 'dias seguidos'}
        </span>
      </div>
    </div>
  )
}
