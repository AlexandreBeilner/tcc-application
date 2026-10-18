import type { MoreBlock } from '../../../features/lessons/widgets/schema'
import type { LessonRef } from '../../molecules/LessonCardText'

export interface MoreDetailsProps {
    block: MoreBlock
    open: boolean
    onToggle: (open: boolean) => void
    lessons: LessonRef[]
}
