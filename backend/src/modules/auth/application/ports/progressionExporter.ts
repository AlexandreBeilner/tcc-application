// Port própria e mínima sobre `modules/gamification` (5.1/5.3) —
// implementada, na composição (app.ts), por um adapter em processo sobre
// `GetProgressionUseCase` (mesmo padrão de composição do resto da semana).
export interface ExportedProgression {
  xp: number
  level: number
  currentStreak: number
  longestStreak: number
  lastQualifyingActivityDate: string | null
}

export interface ProgressionExporter {
  exportForUser(userId: string): Promise<ExportedProgression>
}
