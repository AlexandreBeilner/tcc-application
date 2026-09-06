import { apiRequest } from '../client'
import type { AdvanceLessonResult, GetLessonResult, ListLessonsResult } from './types'

export type { Lesson, ListLessonsResult, GetLessonResult, AdvanceLessonResult, MicroDecisionType } from './types'

export function listLessons(token: string): Promise<ListLessonsResult> {
    return apiRequest<ListLessonsResult>('/lessons', { token })
}

export function getLesson(token: string, id: string): Promise<GetLessonResult> {
    return apiRequest<GetLessonResult>(`/lessons/${id}`, { token })
}

export function advanceLesson(token: string, id: string, step: number): Promise<AdvanceLessonResult> {
    return apiRequest<AdvanceLessonResult>(`/lessons/${id}/progress`, {
        token,
        method: 'POST',
        body: { step },
    })
}
