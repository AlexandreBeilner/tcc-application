import type { DailyWord } from '../../domain/content'

export type NewDailyWord = Omit<DailyWord, 'id'>

export type DailyWordFields = Partial<
  Pick<DailyWord, 'display' | 'definition' | 'learnMore' | 'category' | 'scope' | 'active'>
>

export interface DailyWordRepository {
  // Falha se `answer` ou `stableKey` já existem.
  create(word: NewDailyWord): Promise<DailyWord>
  findById(id: string): Promise<DailyWord | null>
  listActive(): Promise<DailyWord[]>
  // Painel: inclui as desativadas.
  listAll(): Promise<DailyWord[]>
  // `answer` e `stableKey` não mudam (jogos já jogados dependem delas). Nulo = não existe.
  update(id: string, fields: DailyWordFields, updatedBy: string): Promise<DailyWord | null>
}
