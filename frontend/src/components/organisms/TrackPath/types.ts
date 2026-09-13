import type { Lesson } from '../../../services/lessons'

export interface TrackPathProps {
    lessons: Lesson[]
    accentColor: string
    expandedHintId: string | null
    onNodeClick: (lesson: Lesson) => void
}
