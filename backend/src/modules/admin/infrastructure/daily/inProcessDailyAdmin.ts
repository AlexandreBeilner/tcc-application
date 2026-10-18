import type {
  AddAcceptedWordUseCase,
  CreateAdminEventUseCase,
  CreateAdminQuestionUseCase,
  CreateAdminWordUseCase,
  ListAcceptedExtraUseCase,
  ListAdminEventsUseCase,
  ListAdminQuestionsUseCase,
  ListAdminWordsUseCase,
  RemoveAcceptedWordUseCase,
  UpdateAdminEventUseCase,
  UpdateAdminQuestionUseCase,
  UpdateAdminWordUseCase,
} from '../../../daily/application/useCases/admin/content'
import type {
  PrepareLaunchDraftUseCase,
  SetStartDateUseCase,
} from '../../../daily/application/useCases/admin/launch'
import type { GetDailyMetricsUseCase } from '../../../daily/application/useCases/admin/metrics'
import type { GetDailyAdminOverviewUseCase } from '../../../daily/application/useCases/admin/overview'
import type {
  GetAdminPuzzleUseCase,
  PublishPuzzlesUseCase,
  ReplacePuzzleCardUseCase,
} from '../../../daily/application/useCases/admin/puzzles'
import {
  DailyAdminConflictError,
  DailyAdminInvalidError,
  DailyAdminNotFoundError,
} from '../../../daily/domain/errors'
import {
  AdminDailyConflictError,
  AdminDailyNotFoundError,
  InvalidAdminDailyError,
} from '../../domain/errors'
import type { DailyAdmin } from '../../application/ports/dailyAdmin'

export interface InProcessDailyAdminDeps {
  overview: GetDailyAdminOverviewUseCase
  metrics: GetDailyMetricsUseCase
  getPuzzle: GetAdminPuzzleUseCase
  publishPuzzles: PublishPuzzlesUseCase
  replaceCard: ReplacePuzzleCardUseCase
  prepareDraft: PrepareLaunchDraftUseCase
  setStartDate: SetStartDateUseCase
  listWords: ListAdminWordsUseCase
  createWord: CreateAdminWordUseCase
  updateWord: UpdateAdminWordUseCase
  listAcceptedExtra: ListAcceptedExtraUseCase
  addAcceptedWord: AddAcceptedWordUseCase
  removeAcceptedWord: RemoveAcceptedWordUseCase
  listQuestions: ListAdminQuestionsUseCase
  createQuestion: CreateAdminQuestionUseCase
  updateQuestion: UpdateAdminQuestionUseCase
  listEvents: ListAdminEventsUseCase
  createEvent: CreateAdminEventUseCase
  updateEvent: UpdateAdminEventUseCase
}

function translate(err: unknown): never {
  if (err instanceof DailyAdminNotFoundError) throw new AdminDailyNotFoundError(err.message)
  if (err instanceof DailyAdminConflictError) {
    throw new AdminDailyConflictError(err.code, err.message)
  }
  if (err instanceof DailyAdminInvalidError) throw new InvalidAdminDailyError(err.problems)
  throw err
}

// Embrulha cada chamada para as recusas do módulo dono virarem erros do painel.
async function guarded<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call()
  } catch (err) {
    return translate(err)
  }
}

export function createInProcessDailyAdmin(deps: InProcessDailyAdminDeps): DailyAdmin {
  return {
    overview: () => guarded(() => deps.overview.execute()),
    metrics: (days) => guarded(() => deps.metrics.execute({ days })),
    getPuzzle: (number) => guarded(() => deps.getPuzzle.execute(number)),
    publishPuzzles: (numbers) => guarded(() => deps.publishPuzzles.execute(numbers)),
    replaceCard: (number, input, confirm) =>
      guarded(() => deps.replaceCard.execute(number, input, confirm)),
    prepareDraft: (startDate) => guarded(() => deps.prepareDraft.execute(startDate)),
    setStartDate: (actorId, next) => guarded(() => deps.setStartDate.execute(actorId, next)),
    listWords: () => guarded(() => deps.listWords.execute()),
    createWord: (input) => guarded(() => deps.createWord.execute(input)),
    updateWord: (actorId, id, patch, confirm) =>
      guarded(() => deps.updateWord.execute(actorId, id, patch, confirm)),
    listAcceptedExtra: () => guarded(() => deps.listAcceptedExtra.execute()),
    addAcceptedWord: (word) => guarded(() => deps.addAcceptedWord.execute(word)),
    removeAcceptedWord: (word) => guarded(() => deps.removeAcceptedWord.execute(word)),
    listQuestions: () => guarded(() => deps.listQuestions.execute()),
    createQuestion: (input) => guarded(() => deps.createQuestion.execute(input)),
    updateQuestion: (actorId, id, patch, confirm) =>
      guarded(() => deps.updateQuestion.execute(actorId, id, patch, confirm)),
    listEvents: () => guarded(() => deps.listEvents.execute()),
    createEvent: (input) => guarded(() => deps.createEvent.execute(input)),
    updateEvent: (actorId, id, patch, confirm) =>
      guarded(() => deps.updateEvent.execute(actorId, id, patch, confirm)),
  }
}
