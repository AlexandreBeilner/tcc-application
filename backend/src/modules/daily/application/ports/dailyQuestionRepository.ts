import type { DailyQuestion } from '../../domain/content'

export type NewDailyQuestion = Omit<DailyQuestion, 'id'>

export interface DailyQuestionRepository {
  // Falha se `stableKey` já existe.
  create(question: NewDailyQuestion): Promise<DailyQuestion>
  findById(id: string): Promise<DailyQuestion | null>
  findManyByIds(ids: readonly string[]): Promise<DailyQuestion[]>
  listActive(): Promise<DailyQuestion[]>
}
