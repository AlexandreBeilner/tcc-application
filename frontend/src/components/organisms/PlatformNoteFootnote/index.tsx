import { ChevronRight, Landmark } from 'lucide-react'
import { widgetPropsSchemas } from '../../../features/lessons/widgets/schema'
import { LessonWidget } from '../LessonWidget'
import { PLATFORM_NOTE_TITLE, PlatformNoteRows, platformNoteSummary } from '../PlatformNote'
import type { PlatformNoteFootnoteProps } from './types'
import styles from './index.module.css'

export type { PlatformNoteFootnoteProps } from './types'

// "Na plataforma" como rodapé recolhido do cartão anterior (LJ.1.3): o selo vira o resumo de um `<details>`
// fechado e as três linhas aparecem ao abrir, para a lição não terminar num aviso. `<details>` dá teclado
// (Enter e Espaço no resumo) e leitor de tela de graça; o aberto/fechado fica com o player, que lembra
// enquanto a lição está aberta. Props fora do schema caem no fallback do próprio widget.
export function PlatformNoteFootnote({ block, open, onToggle }: PlatformNoteFootnoteProps) {
    const parsed = widgetPropsSchemas['platform-note'].safeParse(block.props)
    if (!parsed.success) {
        return <LessonWidget block={block} />
    }

    return (
        <details
            className={styles.footnote}
            open={open}
            onToggle={(event) => {
                const isOpen = event.currentTarget.open
                if (isOpen !== open) onToggle(isOpen)
            }}
            aria-label={platformNoteSummary(parsed.data)}
        >
            <summary className={styles.summary}>
                <Landmark size={16} aria-hidden="true" />
                {PLATFORM_NOTE_TITLE}
                <ChevronRight size={16} className={styles.chevron} aria-hidden="true" />
            </summary>
            <PlatformNoteRows {...parsed.data} />
        </details>
    )
}
