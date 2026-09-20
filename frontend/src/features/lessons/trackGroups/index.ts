import type { Lesson } from '../../../services/lessons'
import type { TrackGroup, TrackStatus } from './types'

export type { TrackGroup, TrackStatus } from './types'

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

// Status do card de trilha no Hub (tarefa O.1) — mesmo critério de
// `findActiveTrackNumber`: uma trilha só é "bloqueada" quando NENHUMA das
// suas lições é `available`/`completed` (não dá pra usar "primeira lição
// locked", já que `sortOrder` é sequencial pra trilha inteira de 35 lições,
// não por trilha isolada).
export function trackStatusFor(group: TrackGroup): TrackStatus {
    if (group.lessons.every((lesson) => lesson.status === 'completed')) return 'completed'
    if (group.lessons.some((lesson) => lesson.status === 'available' || lesson.status === 'completed')) return 'active'
    return 'locked'
}
