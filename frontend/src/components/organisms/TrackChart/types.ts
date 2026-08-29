import type { Lesson } from '../../../services/lessons'

export interface TrackChartProps {
    lessons: Lesson[]
    expandedHintId: string | null
    onNodeClick: (lesson: Lesson) => void
}
