import { apiRequest } from './client'

// Espelha `.docs/backend/lessons.md` (`GET /lessons`) — `status` já vem
// calculado por usuário (`completed`/`available`/`locked`), ordenado por
// `sortOrder`; o frontend nunca recalcula bloqueio no cliente.
export interface Lesson {
    id: string
    code: string
    title: string
    trackNumber: number
    trackName: string
    sortOrder: number
    centralConcept: string
    unlocksDescription: string
    status: 'completed' | 'available' | 'locked'
    currentStep: number
}

export interface ListLessonsResult {
    lessons: Lesson[]
}

export function listLessons(token: string): Promise<ListLessonsResult> {
    return apiRequest<ListLessonsResult>('/lessons', { token })
}
