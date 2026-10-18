// Port própria e mínima sobre `modules/daily` (DI.6.1), mesmo padrão de `microDecisionStreakChecker.ts`:
// a missão "Jogue o Diário" só conclui se o jogo do dia foi fechado antes da virada (com XP).
export interface DailyCompletionChecker {
  hasCompletedDailyToday(userId: string): Promise<boolean>
}
