import { apiRequest } from '../client'
import type { AdvanceLessonResult, GetLessonResult, ListLessonsResult, ReviewLessonResult } from './types'

export type {
    Lesson,
    ListLessonsResult,
    GetLessonResult,
    AdvanceLessonResult,
    ReviewLessonResult,
    MicroDecisionType,
    UnlockedAchievement,
} from './types'

export function listLessons(token: string): Promise<ListLessonsResult> {
    return apiRequest<ListLessonsResult>('/lessons', { token })
}

export function getLesson(token: string, id: string): Promise<GetLessonResult> {
    return apiRequest<GetLessonResult>(`/lessons/${id}`, { token })
}

// `selectedOption` (backlog engajamento B.2) — escolha real do passo
// Micro-decisão, só relevante pra lição com `microDecisionOptions`
// preenchido. Omitido do corpo (não enviado como `undefined`) quando
// ausente, pra não alterar o payload das chamadas que não fazem aposta real.
export function advanceLesson(token: string, id: string, step: number, selectedOption?: number): Promise<AdvanceLessonResult> {
    return apiRequest<AdvanceLessonResult>(`/lessons/${id}/progress`, {
        token,
        method: 'POST',
        body: selectedOption === undefined ? { step } : { step, selectedOption },
    })
}

export function reviewLesson(token: string, id: string): Promise<ReviewLessonResult> {
    return apiRequest<ReviewLessonResult>(`/lessons/${id}/review`, { token, method: 'POST' })
}
