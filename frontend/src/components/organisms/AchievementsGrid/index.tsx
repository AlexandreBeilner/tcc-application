import { Award, Lock } from 'lucide-react'
import { describeAchievementProgress } from '../../../features/achievements/describeAchievementProgress'
import type { AchievementsGridProps } from './types'
import styles from './index.module.css'

export type { AchievementsGridProps } from './types'

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

// Tela 7.2 (RF09) — grid reduz colunas conforme a largura (2/3/4, backlog
// 6.8), nunca contagem fixa que force scroll horizontal. Bloqueada usa
// borda tracejada (convenção sólido/tracejado, identidade-visual-padroes.md
// §3: tracejado = ainda não aconteceu); desbloqueada ganha o dourado de
// "teatro de recompensa" (§6). `<details>` (mesma convenção de
// `NewsEventList`, 6.6) pro clique revelar o progresso sem navegação nova
// (inventário 7.2: "sem navegação nova").
export function AchievementsGrid({ achievements }: AchievementsGridProps) {
    if (achievements.length === 0) {
        return <p className={styles.empty}>Nenhuma conquista cadastrada ainda.</p>
    }

    return (
        <ul className={styles.grid}>
            {achievements.map((achievement) => (
                <li key={achievement.id}>
                    <details className={`${styles.card} ${achievement.unlocked ? styles.unlocked : ''}`}>
                        <summary className={styles.summary}>
                            <span className={styles.icon} aria-hidden="true">
                                {achievement.unlocked ? <Award size={18} strokeWidth={2} /> : <Lock size={18} strokeWidth={2} />}
                            </span>
                            <span className={styles.name}>{achievement.name}</span>
                        </summary>
                        <div className={styles.body}>
                            <p className={styles.description}>{achievement.description}</p>
                            <p className={styles.progress}>
                                {achievement.unlocked && achievement.unlockedAt
                                    ? `Desbloqueada em ${dateFormatter.format(new Date(achievement.unlockedAt))}`
                                    : describeAchievementProgress(achievement)}
                            </p>
                        </div>
                    </details>
                </li>
            ))}
        </ul>
    )
}
