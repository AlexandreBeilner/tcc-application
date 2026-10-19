import type { DailyEvent } from '../../domain/content'

export type NewDailyEvent = Omit<DailyEvent, 'id'>

export type DailyEventFields = Partial<
  Pick<
    DailyEvent,
    'year' | 'label' | 'explanation' | 'sourceRef' | 'learnMore' | 'category' | 'scope' | 'active'
  >
>

export interface DailyEventRepository {
  // Falha se `stableKey` já existe.
  create(event: NewDailyEvent): Promise<DailyEvent>
  findById(id: string): Promise<DailyEvent | null>
  findManyByIds(ids: readonly string[]): Promise<DailyEvent[]>
  listActive(): Promise<DailyEvent[]>
  // Painel: inclui as desativadas.
  listAll(): Promise<DailyEvent[]>
  // Nulo = não existe.
  update(id: string, fields: DailyEventFields, updatedBy: string): Promise<DailyEvent | null>
}
