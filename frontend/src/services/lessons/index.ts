import { apiRequest } from '../client'
import type {
    AdvanceLessonResult,
    AnswerCheckpointResult,
    AnswerMicroDecisionResult,
    GetLessonResult,
    ListLessonsResult,
    ReviewLessonResult,
} from './types'

export type {
    Lesson,
    ListLessonsResult,
    GetLessonResult,
    AdvanceLessonResult,
    AnswerCheckpointResult,
    AnswerMicroDecisionResult,
    CheckHint,
    CheckpointState,
    EstimateResult,
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

// `POST /lessons/:id/checkpoints/:checkpointId/answer` (RC.3.2, LJ.2.1): `selectedOption`
// (única escolha ou verdadeiro/falso), `value` (estimativa) ou `sequence` (ordenar). A explicação só
// vem no acerto, exceto na estimativa, que avança acertando ou não; ao errar um formato de várias
// peças vem só a contagem (`hint`).
export function answerCheckpoint(
    token: string,
    id: string,
    checkpointId: string,
    response: { selectedOption: number } | { value: number } | { sequence: number[] },
): Promise<AnswerCheckpointResult> {
    return apiRequest<AnswerCheckpointResult>(`/lessons/${id}/checkpoints/${encodeURIComponent(checkpointId)}/answer`, {
        token,
        method: 'POST',
        body: response,
    })
}

export function reviewLesson(token: string, id: string): Promise<ReviewLessonResult> {
    return apiRequest<ReviewLessonResult>(`/lessons/${id}/review`, { token, method: 'POST' })
}

// Funil por cartão (LJ.5.1): `phase` 0 a 3 (Cenário, Micro-decisão, Revelação, tela final) e a posição
// do cartão na fase. Fire-and-forget do player; o resultado não muda nada na tela.
export function recordCardReach(token: string, id: string, phase: number, cardIndex: number): Promise<{ recorded: boolean }> {
    return apiRequest<{ recorded: boolean }>(`/lessons/${id}/cards/reached`, { token, method: 'POST', body: { phase, cardIndex } })
}
