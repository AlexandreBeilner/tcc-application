import { Info, Lightbulb, TriangleAlert } from 'lucide-react'
import type { LessonCalloutProps } from './types'
import styles from './index.module.css'

export type { LessonCalloutProps } from './types'

const ICONS = { info: Info, tip: Lightbulb, warning: TriangleAlert }

// Destaque visual sem interação (RC.3.1): ícone, termo-chave e, opcionalmente,
// a fórmula, para a tela deixar de ser só texto corrido. O tom nunca usa as
// cores de ganho/perda (identidade-visual-tokens.md §2.3: vermelho/verde são
// de dado financeiro); o ícone distingue o tom, não só a cor.
export function LessonCallout({ tone = 'info', title, body, formula }: LessonCalloutProps) {
    const Icon = ICONS[tone]

    return (
        <aside className={`${styles.callout} ${styles[tone]}`}>
            <Icon size={20} aria-hidden="true" className={styles.icon} />
            <div className={styles.content}>
                <h2 className={styles.title}>{title}</h2>
                <p className={styles.body}>{body}</p>
                {formula && <code className={styles.formula}>{formula}</code>}
            </div>
        </aside>
    )
}
