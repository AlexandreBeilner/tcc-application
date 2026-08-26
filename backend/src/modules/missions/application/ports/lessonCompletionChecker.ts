// Port própria e mínima sobre `modules/lessons` (5.6) — a missão "complete
// uma lição da trilha" é a única com verificação cruzada real; as demais
// aceitam o relato do cliente (ver domain/mission.ts).
export interface LessonCompletionChecker {
  hasCompletedLessonToday(userId: string): Promise<boolean>
}
