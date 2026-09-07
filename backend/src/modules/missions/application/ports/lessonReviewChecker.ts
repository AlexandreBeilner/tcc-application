// Port própria e mínima sobre `modules/lessons` (H.2), mesmo padrão de
// `lessonCompletionChecker.ts` — a missão "revise uma lição antiga" é a
// segunda com verificação cruzada real; as demais aceitam o relato do
// cliente (ver domain/mission.ts).
export interface LessonReviewChecker {
  hasReviewedOldLessonToday(userId: string): Promise<boolean>
}
