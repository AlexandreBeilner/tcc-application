import { apiRequest } from '../client'
import type {
    AdvanceLessonResult,
    AnswerCheckpointResult,
    AnswerMicroDecisionResult,
    GetLessonResult,
    ListLessonsResult,
    ReviewLessonResult,
    ReviewSession,
} from './types'

export type {
    Lesson,
    PracticeQuestion,
    ListLessonsResult,
    GetLessonResult,
    AdvanceLessonResult,
    AnswerCheckpointResult,
    AnswerMicroDecisionResult,
    CheckHint,
    CheckpointState,
    EstimateResult,
    ReviewLessonResult,
    ReviewSession,
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
// (única escolha ou verdadeiro/falso), `value` (estimativa), `sequence` (ordenar), `groups` (agrupar) ou `pair` (ligar, um par por vez). A explicação só
// vem no acerto, exceto na estimativa, que avança acertando ou não; ao errar um formato de várias
// peças vem só a contagem (`hint`). `practice` (Relembra, revisão de 1 minuto) só muda a resposta de pergunta de
// leitura: a explicação vem também no erro.
export function answerCheckpoint(
    token: string,
    id: string,
    checkpointId: string,
    response: { selectedOption: number } | { value: number } | { sequence: number[] } | { groups: number[] } | { pair: [number, number] },
    options: { practice?: boolean } = {},
): Promise<AnswerCheckpointResult> {
    return apiRequest<AnswerCheckpointResult>(`/lessons/${id}/checkpoints/${encodeURIComponent(checkpointId)}/answer`, {
        token,
        method: 'POST',
        body: options.practice ? { ...response, practice: true } : response,
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

// Revisão de 1 minuto (LJ.5.6): as 3 perguntas vencidas e o resultado de cada uma. `correct` é "acertou sem errar
// antes"; a rota só age em pergunta vencida, uma vez por vencimento.
export function getReviewSession(token: string): Promise<ReviewSession> {
    return apiRequest<ReviewSession>('/lessons/review/session', { token })
}

export function recordReviewResult(token: string, id: string, checkpointId: string, correct: boolean): Promise<{ recorded: boolean }> {
    return apiRequest<{ recorded: boolean }>(`/lessons/${id}/checkpoints/${encodeURIComponent(checkpointId)}/review`, {
        token,
        method: 'POST',
        body: { correct },
    })
}
