import { Landmark } from 'lucide-react'
import type { PlatformNoteProps } from './types'
import styles from './index.module.css'

export type { PlatformNoteProps } from './types'

export const PLATFORM_NOTE_TITLE = 'Na plataforma'

export function platformNoteSummary({ brazil, here, why }: PlatformNoteProps): string {
    return `${PLATFORM_NOTE_TITLE}. No Brasil: ${brazil} Aqui: ${here} Por quê: ${why}`
}

// Bloco "Na plataforma" (RC.3.3): único lugar da lição onde se fala da
// mecânica da plataforma. Três linhas fixas (No Brasil, Aqui, Por quê), com selo
// próprio e borda tracejada para nunca parecer parte do texto principal nem
// usar as cores de ganho/perda (identidade-visual-tokens.md §2.3).
// Fica fora da varredura de conteúdo proibido (`content/visibleContent.test`)
// justamente por ser o lugar permitido para a expressão.
export function PlatformNote({ brazil, here, why }: PlatformNoteProps) {
    return (
        <aside className={styles.note} aria-label={PLATFORM_NOTE_TITLE}>
            <p className={styles.badge}>
                <Landmark size={16} aria-hidden="true" />
                {PLATFORM_NOTE_TITLE}
            </p>
            <dl className={styles.rows}>
                <div className={styles.row}>
                    <dt className={styles.label}>No Brasil</dt>
                    <dd className={styles.text}>{brazil}</dd>
                </div>
                <div className={styles.row}>
                    <dt className={styles.label}>Aqui</dt>
                    <dd className={styles.text}>{here}</dd>
                </div>
                <div className={styles.row}>
                    <dt className={styles.label}>Por quê</dt>
                    <dd className={styles.text}>{why}</dd>
                </div>
            </dl>
        </aside>
    )
}
