// Port própria e mínima sobre `modules/lessons` (H.3), mesmo padrão de
// `lessonCompletionChecker.ts`/`lessonReviewChecker.ts` — a missão "acerte 3
// apostas seguidas hoje" é a terceira com verificação cruzada real.
export interface MicroDecisionStreakChecker {
  hasMicroDecisionStreakToday(userId: string): Promise<boolean>
}
