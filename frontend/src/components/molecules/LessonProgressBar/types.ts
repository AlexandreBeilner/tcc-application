import type { ProgressMarker } from '../../../features/lessons/lessonProgress'

export interface LessonProgressBarProps {
    current: number
    total: number
    markers: ProgressMarker[]
}
