import type { LessonScoreboardProps } from './types'
import styles from './index.module.css'

export type { LessonScoreboardProps } from './types'

const DOT_CLASS = { pending: styles.dotPending, 'first-try': styles.dotFirstTry, later: styles.dotLater } as const

// Placar da tela final (LJ.1.4): a mesma fileira de marcos da barra de progresso (âmbar de primeira, neutro
// depois, vazado sem resposta), só que maior, e a frase ao lado. Os pontos são decoração; a frase diz tudo.
export function LessonScoreboard({ states, summary }: LessonScoreboardProps) {
    return (
        <div className={styles.scoreboard}>
            <div className={styles.dots} aria-hidden="true">
                {states.map((state, index) => (
                    <span key={index} className={`${styles.dot} ${DOT_CLASS[state]}`} />
                ))}
            </div>
            <p className={styles.summary}>{summary}</p>
        </div>
    )
}
