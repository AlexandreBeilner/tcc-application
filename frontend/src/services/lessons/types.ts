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
    // Vocabulário fixo (tarefa 7.0.1): 'portfolio', 'calculator', 'news_feed'
    // ou 'asset:<AssetType>' — ver `features/lessons/unlockedKeys.ts`, que
    // espelha em TS puro o mesmo cálculo do backend a partir deste campo,
    // sem endpoint novo.
    unlocksKeys: string[]
    status: 'completed' | 'available' | 'locked'
    currentStep: number
}

export interface ListLessonsResult {
    lessons: Lesson[]
}

export interface GetLessonResult {
    lesson: Lesson
}

// `GET /lessons/:id` reaproveita o mesmo formato de `Lesson` (`.docs/backend/lessons.md`).
export interface AdvanceLessonResult {
    currentStep: number
    completed: boolean
}
