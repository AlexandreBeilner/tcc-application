import { MaterializeUpcomingPuzzlesUseCase } from '../application/useCases/materializeUpcomingPuzzles'
import {
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
} from '../application/useCases/admin/content'
import {
  PrepareLaunchDraftUseCase,
  SetStartDateUseCase,
} from '../application/useCases/admin/launch'
import { GetDailyAdminOverviewUseCase } from '../application/useCases/admin/overview'
import { GetDailyMetricsUseCase } from '../application/useCases/admin/metrics'
import {
  GetAdminPuzzleUseCase,
  PublishPuzzlesUseCase,
  ReplacePuzzleCardUseCase,
  ReviewPuzzleUseCase,
} from '../application/useCases/admin/puzzles'
import type { DailyEvent, DailyQuestion, DailyWord } from '../domain/content'
import {
  createFakeAcceptedWordRepository,
  createFakeDailyEventRepository,
  createFakeDailyMetricsRepository,
  createFakeDailyPuzzleRepository,
  createFakeDailyQuestionRepository,
  createFakeDailySettingsRepository,
  createFakeDailyWordRepository,
} from './fakes/fakeDailyRepositories'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

// Palavras de 5 letras distintas e válidas (a regra do banco é 4 a 9 letras A-Z).
export function wordFixture(i: number): DailyWord {
  const answer = `P${LETTERS[i % 26]}${LETTERS[Math.floor(i / 26)]}AL`
  return {
    id: `w${i}`,
    stableKey: `w:${answer.toLowerCase()}`,
    answer,
    display: answer,
    definition: 'Definição.',
    learnMore: null,
    category: ['juros-e-inflacao', 'instituicoes', 'bolsa-e-acoes'][i % 3],
    scope: i % 6 === 5 ? 'fora' : 'brasil',
    active: true,
  }
}

export function questionFixture(i: number): DailyQuestion {
  return {
    id: `q${i}`,
    stableKey: `q:k${i}`,
    question: `Pergunta ${i}?`,
    options: ['Um', 'Dois', 'Três', 'Quatro'],
    correctIndex: i % 4,
    explanation: 'Explicação curta.',
    sourceRef: 'Banco Central do Brasil',
    learnMore: null,
    category: ['juros-e-inflacao', 'instituicoes', 'crises-e-choques', 'planos-e-moeda'][i % 4],
    scope: i % 7 === 6 ? 'fora' : 'brasil',
    reviewedAt: null,
    active: true,
  }
}

export function eventFixture(i: number): DailyEvent {
  return {
    id: `e${i}`,
    stableKey: `e:k${i}`,
    year: 1800 + i,
    label: `Evento ${i}`,
    explanation: 'Explicação curta.',
    sourceRef: 'Banco Central do Brasil',
    learnMore: null,
    category: ['planos-e-moeda', 'crises-e-choques', 'instituicoes'][i % 3],
    scope: i % 5 === 4 ? 'fora' : 'brasil',
    reviewedAt: null,
    active: true,
  }
}

export const ADMIN = 'admin-1'

// Mundo do painel com os repositórios falsos e um relógio que o teste move. Conteúdo suficiente
// para a agenda materializar 30 dias sem aviso.
export function buildAdminWorld(options: { startDate: string | null; now: string }) {
  const clock = { now: new Date(options.now) }
  const now = () => clock.now
  const settings = createFakeDailySettingsRepository(options.startDate)
  const words = createFakeDailyWordRepository(Array.from({ length: 60 }, (_, i) => wordFixture(i)))
  const questions = createFakeDailyQuestionRepository(
    Array.from({ length: 60 }, (_, i) => questionFixture(i)),
  )
  const events = createFakeDailyEventRepository(
    Array.from({ length: 200 }, (_, i) => eventFixture(i)),
  )
  const puzzles = createFakeDailyPuzzleRepository()
  const accepted = createFakeAcceptedWordRepository(
    words.items.map((w) => w.answer),
    ['SELIC'],
  )
  const metricsRepo = createFakeDailyMetricsRepository()
  const materialize = new MaterializeUpcomingPuzzlesUseCase(
    settings,
    words,
    questions,
    events,
    puzzles,
    now,
  )
  return {
    clock,
    metricsRepo,
    settings,
    words,
    questions,
    events,
    puzzles,
    accepted,
    materialize,
    overview: new GetDailyAdminOverviewUseCase(
      settings,
      puzzles,
      words,
      questions,
      events,
      accepted,
      now,
    ),
    getPuzzle: new GetAdminPuzzleUseCase(puzzles, words, questions, events, now),
    reviewPuzzle: new ReviewPuzzleUseCase(puzzles, words, questions, events, now),
    publishPuzzles: new PublishPuzzlesUseCase(puzzles, now),
    replaceCard: new ReplacePuzzleCardUseCase(puzzles, words, questions, events, now),
    prepareDraft: new PrepareLaunchDraftUseCase(settings, puzzles, materialize, now),
    setStartDate: new SetStartDateUseCase(settings, puzzles, materialize, now),
    listWords: new ListAdminWordsUseCase(words),
    createWord: new CreateAdminWordUseCase(words, accepted),
    updateWord: new UpdateAdminWordUseCase(words, accepted, puzzles),
    listAcceptedExtra: new ListAcceptedExtraUseCase(accepted),
    addAcceptedWord: new AddAcceptedWordUseCase(accepted),
    removeAcceptedWord: new RemoveAcceptedWordUseCase(accepted, words),
    listQuestions: new ListAdminQuestionsUseCase(questions),
    createQuestion: new CreateAdminQuestionUseCase(questions),
    updateQuestion: new UpdateAdminQuestionUseCase(questions, puzzles),
    listEvents: new ListAdminEventsUseCase(events),
    createEvent: new CreateAdminEventUseCase(events),
    updateEvent: new UpdateAdminEventUseCase(events, puzzles),
    metrics: new GetDailyMetricsUseCase(metricsRepo, now),
  }
}

export type AdminWorld = ReturnType<typeof buildAdminWorld>

// Revisa todos os jogos materializados.
export async function reviewAll(world: AdminWorld): Promise<void> {
  for (const puzzle of [...world.puzzles.items]) {
    await world.reviewPuzzle.execute(ADMIN, puzzle.number)
  }
}
