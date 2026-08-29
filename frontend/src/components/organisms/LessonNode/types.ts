import type { Lesson } from '../../../services/lessons'

export interface LessonNodeProps {
    lesson: Lesson
    onClick: () => void
}
