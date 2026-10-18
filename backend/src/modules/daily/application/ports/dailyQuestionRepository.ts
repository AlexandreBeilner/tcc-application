import type { DailyQuestion } from '../../domain/content'

export type NewDailyQuestion = Omit<DailyQuestion, 'id'>

export type DailyQuestionFields = Partial<
  Pick<
    DailyQuestion,
    | 'question'
    | 'options'
    | 'correctIndex'
    | 'explanation'
    | 'sourceRef'
    | 'learnMore'
    | 'category'
    | 'scope'
    | 'active'
    | 'reviewedAt'
  >
>

export interface DailyQuestionRepository {
  // Falha se `stableKey` já existe.
  create(question: NewDailyQuestion): Promise<DailyQuestion>
  findById(id: string): Promise<DailyQuestion | null>
  findManyByIds(ids: readonly string[]): Promise<DailyQuestion[]>
  listActive(): Promise<DailyQuestion[]>
  // Painel: inclui as desativadas.
  listAll(): Promise<DailyQuestion[]>
  // `reviewedAt` entra no patch para o painel zerar a revisão de quem foi editado. Nulo = não existe.
  update(id: string, fields: DailyQuestionFields, updatedBy: string): Promise<DailyQuestion | null>
  markReviewed(ids: readonly string[], reviewedBy: string, now: Date): Promise<void>
}
