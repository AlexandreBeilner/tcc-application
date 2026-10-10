import type { MonthRange } from '../../domain/retrospective'

export interface MonthActivity {
  lessonsCompleted: number
  achievementNames: string[]
  // Nível atual (não há histórico de XP: não é preciso).
  level: number
  // Dias do mês (1 a 31) com atividade qualificadora; os demais foram dias off.
  activeDays: number[]
  duelsPlayed: number
  duelsWon: number
  leaguesActive: number
}

export interface MonthActivityReader {
  read(userId: string, range: MonthRange): Promise<MonthActivity>
  // Quando a conta foi criada; `null` se a pessoa não existe ou está suspensa.
  findCreatedAt(userId: string): Promise<Date | null>
  // Contas ativas, para o job mensal.
  listActiveUserIds(): Promise<string[]>
}
