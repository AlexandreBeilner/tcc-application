import type { Lesson } from '../../../services/lessons'
import type { TrackGroup } from './types'

export type { TrackGroup } from './types'

// `GET /lessons` já devolve ordenado por `sortOrder` global — agrupar só
// precisa preservar essa ordem dentro de cada trilha, nunca reordenar.
export function groupLessonsByTrack(lessons: Lesson[]): TrackGroup[] {
    const byTrack = new Map<number, TrackGroup>()

    for (const lesson of lessons) {
        const group = byTrack.get(lesson.trackNumber)
        if (group) {
            group.lessons.push(lesson)
        } else {
            byTrack.set(lesson.trackNumber, { trackNumber: lesson.trackNumber, trackName: lesson.trackName, lessons: [lesson] })
        }
    }

    return [...byTrack.values()].sort((a, b) => a.trackNumber - b.trackNumber)
}

// Trilha que contém a lição `available` (ou, se não houver nenhuma, a
// primeira `locked`) — é essa que o Mapa abre expandida por padrão.
export function findActiveTrackNumber(groups: TrackGroup[]): number | undefined {
    const withAvailable = groups.find((group) => group.lessons.some((lesson) => lesson.status === 'available'))
    if (withAvailable) return withAvailable.trackNumber

    const withLocked = groups.find((group) => group.lessons.some((lesson) => lesson.status === 'locked'))
    return withLocked?.trackNumber
}
