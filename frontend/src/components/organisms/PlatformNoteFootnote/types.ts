import type { WidgetBlock } from '../../../features/lessons/widgets/schema'

export interface PlatformNoteFootnoteProps {
    block: WidgetBlock
    open: boolean
    onToggle: (open: boolean) => void
}
