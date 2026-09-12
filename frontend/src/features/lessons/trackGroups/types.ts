import type { Lesson } from '../../../services/lessons'

export interface TrackGroup {
    trackNumber: number
    trackName: string
    lessons: Lesson[]
}

// Status do card de trilha no Hub (tarefa O.1) — 'active' cobre tanto "em
// andamento" (alguma lição completed, nenhuma available ainda porque a
// próxima está bloqueada por outra trilha) quanto o caso normal (tem
// lição `available`).
export type TrackStatus = 'completed' | 'active' | 'locked'
