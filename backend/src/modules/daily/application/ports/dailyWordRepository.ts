import type { DailyWord } from '../../domain/content'

export type NewDailyWord = Omit<DailyWord, 'id'>

export interface DailyWordRepository {
  // Falha se `answer` ou `stableKey` já existem.
  create(word: NewDailyWord): Promise<DailyWord>
  findById(id: string): Promise<DailyWord | null>
  listActive(): Promise<DailyWord[]>
}
