import type {
  AdminOverview,
  AdminPuzzleView,
  ContentChangeResult,
  DraftResult,
  StartDateResult,
} from '../../../daily/application/adminViews'
import type {
  EventInput,
  EventPatch,
  QuestionInput,
  QuestionPatch,
  WordInput,
  WordPatch,
} from '../../../daily/application/useCases/admin/content'
import type { DailyMetricsDay } from '../../../daily/domain/metrics'
import type { ReplaceCardInput } from '../../../daily/application/useCases/admin/puzzles'
import type { DailyEvent, DailyQuestion, DailyWord } from '../../../daily/domain/content'

export type {
  AdminOverview,
  AdminPuzzleView,
  ContentChangeResult,
  DraftResult,
  EventInput,
  EventPatch,
  QuestionInput,
  QuestionPatch,
  ReplaceCardInput,
  StartDateResult,
  WordInput,
  WordPatch,
}
export type { DailyEvent, DailyQuestion, DailyWord, DailyMetricsDay }

type Changed<T> = ContentChangeResult<T> & { changedFields: string[] }

// Painel do Diário (DI.5.1). Cada método passa por um caso de uso do módulo `daily` e traduz as
// recusas dele para os erros `AdminDaily*` de `admin/domain/errors.ts`. `actorId` assina a
// revisão ou a edição.
export interface DailyAdmin {
  overview(): Promise<AdminOverview>
  // Contadores por dia UTC, do mais recente ao mais antigo (DI.7.1).
  metrics(days?: number): Promise<DailyMetricsDay[]>
  getPuzzle(number: number): Promise<AdminPuzzleView>
  reviewPuzzle(actorId: string, number: number): Promise<{ number: number }>
  publishPuzzles(numbers?: number[]): Promise<{ published: number[] }>
  replaceCard(
    actorId: string,
    number: number,
    input: ReplaceCardInput,
    confirmPublished: boolean,
  ): Promise<{ number: number }>
  prepareDraft(startDate: string): Promise<DraftResult>
  setStartDate(actorId: string, next: string | null): Promise<StartDateResult>

  listWords(): Promise<DailyWord[]>
  createWord(input: WordInput): Promise<DailyWord>
  updateWord(
    actorId: string,
    id: string,
    patch: WordPatch,
    confirmPublished: boolean,
  ): Promise<Changed<DailyWord>>

  listAcceptedExtra(): Promise<string[]>
  addAcceptedWord(word: string): Promise<{ word: string }>
  removeAcceptedWord(word: string): Promise<{ word: string }>

  listQuestions(): Promise<DailyQuestion[]>
  createQuestion(input: QuestionInput): Promise<DailyQuestion>
  updateQuestion(
    actorId: string,
    id: string,
    patch: QuestionPatch,
    confirmPublished: boolean,
  ): Promise<Changed<DailyQuestion>>

  listEvents(): Promise<DailyEvent[]>
  createEvent(input: EventInput): Promise<DailyEvent>
  updateEvent(
    actorId: string,
    id: string,
    patch: EventPatch,
    confirmPublished: boolean,
  ): Promise<Changed<DailyEvent>>
}
