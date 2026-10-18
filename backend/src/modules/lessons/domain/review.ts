import type { LessonSummary, UserCheckpointRecord } from './lesson'
import { findCheckBlock, toPublicBlock } from './widgets/lessonBlocks'
import type { PublicCheckBlock } from './widgets/lessonBlocks'

// Revisão espaçada das perguntas erradas (LJ.5.6). A pergunta que a pessoa resolveu depois de errar entra na fila e
// volta em 1, 3 e 7 dias; acertar avança o estágio, errar volta ao primeiro, e depois de três acertos ela sai.
// `stage` é quantas revisões já foram acertadas (0 a 3); `dueAt` é quando volta (`null`: fora da fila).
export const REVIEW_INTERVAL_DAYS = [1, 3, 7] as const

// Perguntas por revisão, e o mínimo vencido para o cartão aparecer no hub (o mesmo número: nunca uma revisão pela metade).
export const REVIEW_SESSION_SIZE = 3

export interface ReviewSchedule {
  stage: number
  dueAt: Date | null
}

function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000)
}

// Primeiro retorno: 1 dia depois do acerto (entrada na fila) ou depois de errar uma revisão.
export function firstReview(now: Date): ReviewSchedule {
  return { stage: 0, dueAt: addDays(now, REVIEW_INTERVAL_DAYS[0]) }
}

// Próximo agendamento depois de responder uma revisão vencida.
export function nextReview(stage: number, correct: boolean, now: Date): ReviewSchedule {
  if (!correct) {
    return firstReview(now)
  }
  const next = stage + 1
  if (next >= REVIEW_INTERVAL_DAYS.length) {
    return { stage: REVIEW_INTERVAL_DAYS.length, dueAt: null }
  }
  return { stage: next, dueAt: addDays(now, REVIEW_INTERVAL_DAYS[next] as number) }
}

export function isReviewDue(dueAt: Date | null | undefined, now: Date): boolean {
  return dueAt != null && dueAt.getTime() <= now.getTime()
}

export interface ReviewQuestion {
  lessonId: string
  lessonTitle: string
  block: PublicCheckBlock
}

// As perguntas da revisão: as vencidas há mais tempo primeiro, só as que ainda existem no conteúdo publicado.
// Menos que o tamanho da revisão não monta nada (o cartão do hub só aparece com o conjunto completo).
export function buildReviewSession(
  due: UserCheckpointRecord[],
  lessons: LessonSummary[],
): ReviewQuestion[] {
  const lessonById = new Map(lessons.map((lesson) => [lesson.id, lesson]))
  const questions = [...due]
    .sort((a, b) => (a.reviewDueAt?.getTime() ?? 0) - (b.reviewDueAt?.getTime() ?? 0))
    .flatMap((record): ReviewQuestion[] => {
      const lesson = lessonById.get(record.lessonId)
      const block = lesson ? findCheckBlock(lesson.blocks, record.checkpointId) : undefined
      if (!lesson || !block) {
        return []
      }
      return [
        {
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          block: toPublicBlock(block) as PublicCheckBlock,
        },
      ]
    })
  return questions.length >= REVIEW_SESSION_SIZE ? questions.slice(0, REVIEW_SESSION_SIZE) : []
}
