export type LessonNodeStatus = 'completed' | 'available' | 'locked'

export interface LessonNodeProps {
    status: LessonNodeStatus
    title: string
    meta: string
    onClick: () => void
}
