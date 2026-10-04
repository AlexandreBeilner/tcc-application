import { apiRequest } from '../client'
import type { AdvanceLessonResult, AnswerMicroDecisionResult, GetLessonResult, ListLessonsResult, ReviewLessonResult } from './types'

export type {
    Lesson,
    ListLessonsResult,
    GetLessonResult,
    AdvanceLessonResult,
    AnswerMicroDecisionResult,
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

// `selectedOption` deixou de viajar aqui na RC.2.3 (o backend o ignora): a
// escolha da Micro-decisão vai em `answerMicroDecision`.
export function advanceLesson(token: string, id: string, step: number): Promise<AdvanceLessonResult> {
    return apiRequest<AdvanceLessonResult>(`/lessons/${id}/progress`, { token, method: 'POST', body: { step } })
}

// `POST /lessons/:id/answer` (RC.2.3): errar não avança, tentativas ilimitadas;
// o gabarito (`correctOptionLabel`) só vem quando `correct` é verdadeiro.
export function answerMicroDecision(token: string, id: string, selectedOption: number): Promise<AnswerMicroDecisionResult> {
    return apiRequest<AnswerMicroDecisionResult>(`/lessons/${id}/answer`, { token, method: 'POST', body: { selectedOption } })
}

export function reviewLesson(token: string, id: string): Promise<ReviewLessonResult> {
    return apiRequest<ReviewLessonResult>(`/lessons/${id}/review`, { token, method: 'POST' })
}
