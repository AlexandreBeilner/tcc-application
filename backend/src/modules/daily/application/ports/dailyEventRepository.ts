import type { DailyEvent } from '../../domain/content'

export type NewDailyEvent = Omit<DailyEvent, 'id'>

export interface DailyEventRepository {
  // Falha se `stableKey` já existe.
  create(event: NewDailyEvent): Promise<DailyEvent>
  findById(id: string): Promise<DailyEvent | null>
  findManyByIds(ids: readonly string[]): Promise<DailyEvent[]>
  listActive(): Promise<DailyEvent[]>
}
