import type { Lesson } from '../../../services/lessons'

export interface TrackChartPoint {
    lesson: Lesson
    x: number
    y: number
}

export interface TrackChartLayout {
    points: TrackChartPoint[]
    fillPath: string | null
    solidPath: string | null
    dashedPath: string | null
    currentPoint: TrackChartPoint | null
}
