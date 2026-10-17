import type { DailyFact } from '../../domain/content'

export type NewDailyFact = Omit<DailyFact, 'id'>

export interface DailyFactRepository {
  // Falha se `stableKey` já existe.
  create(fact: NewDailyFact): Promise<DailyFact>
  findById(id: string): Promise<DailyFact | null>
  findManyByIds(ids: readonly string[]): Promise<DailyFact[]>
  listActive(): Promise<DailyFact[]>
}
