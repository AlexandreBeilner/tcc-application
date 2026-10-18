import { Check, Sparkles } from 'lucide-react'
import { useCountUp } from '../../../features/lessons/useCountUp'
import { LessonScoreboard } from '../../molecules/LessonScoreboard'
import type { LessonFinishProps } from './types'
import styles from './index.module.css'

export type { LessonFinishProps } from './types'

// Tela final da lição (LJ.1.4): resultado, placar, XP, "O que ficou" e o próximo passo. A celebração do XP é
// esta contagem; o aviso global de "+N XP" não dispara na conclusão (ver `useAdvanceLesson`), senão o valor
// apareceria duas vezes.
// No desktop o resultado (placar e XP) e "O que ficou" ficam lado a lado, e o próximo passo ocupa a largura toda.
export function LessonFinish({
    lessonTitle,
    resultTitle,
    score,
    xpAwarded,
    summary,
    nextStepText,
    teaser,
    share,
    actions,
}: LessonFinishProps) {
    const xpShown = useCountUp(xpAwarded ?? 0)
    const hasSummary = summary !== undefined && summary.length > 0

    return (
        <section className={hasSummary ? styles.finish : `${styles.finish} ${styles.noKept}`} aria-labelledby="lesson-finish-title">
            <div className={styles.result}>
                <span className={styles.badge} aria-hidden="true">
                    <Check size={22} strokeWidth={3} />
                </span>
                <span className={styles.eyebrow}>{lessonTitle}</span>
                <h1 id="lesson-finish-title" className={styles.title}>
                    {resultTitle}
                </h1>
                {score && <LessonScoreboard states={score.states} summary={score.summary} />}
                {xpAwarded !== undefined && xpAwarded > 0 && (
                    <p className={styles.xp}>
                        <Sparkles size={18} strokeWidth={2.2} aria-hidden="true" />
                        <span className={styles.srOnly}>{`Você ganhou ${xpAwarded} XP`}</span>
                        <span aria-hidden="true">{`+${xpShown} XP`}</span>
                    </p>
                )}
                {share}
            </div>

            {hasSummary && (
                <div className={styles.kept}>
                    <h2 className={styles.keptTitle}>O que ficou</h2>
                    <ul className={styles.keptList}>
                        {summary.map((item) => (
                            <li key={item}>{item}</li>
                        ))}
                    </ul>
                </div>
            )}

            <div className={styles.next}>
                <p className={styles.nextText}>{nextStepText}</p>
                {teaser && (
                    <div className={styles.teaser}>
                        <span className={styles.teaserLabel}>Na próxima</span>
                        <p className={styles.teaserTitle}>{teaser.title}</p>
                        {teaser.excerpt && <p className={styles.teaserExcerpt}>{teaser.excerpt}</p>}
                    </div>
                )}
                <div className={styles.actions}>{actions}</div>
            </div>
        </section>
    )
}
