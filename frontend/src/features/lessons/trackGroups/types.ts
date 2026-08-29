import type { Lesson } from '../../../services/lessons'

export interface TrackGroup {
    trackNumber: number
    trackName: string
    lessons: Lesson[]
}
