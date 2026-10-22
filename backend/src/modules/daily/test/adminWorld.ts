import { MaterializeUpcomingPuzzlesUseCase } from '../application/useCases/materializeUpcomingPuzzles'
import {
  AddAcceptedWordUseCase,
  CreateAdminQuestionUseCase,
  CreateAdminWordUseCase,
  ListAcceptedExtraUseCase,
  ListAdminQuestionsUseCase,
  ListAdminWordsUseCase,
  RemoveAcceptedWordUseCase,
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
} from '../application/useCases/admin/puzzles'
import type { DailyQuestion, DailyWord } from '../domain/content'
import {
  createFakeAcceptedWordRepository,
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
    puzzles,
    now,
  )
  return {
    clock,
    metricsRepo,
    settings,
    words,
    questions,
    puzzles,
    accepted,
    materialize,
    overview: new GetDailyAdminOverviewUseCase(settings, puzzles, words, questions, accepted, now),
    getPuzzle: new GetAdminPuzzleUseCase(puzzles, words, questions, now),
    publishPuzzles: new PublishPuzzlesUseCase(puzzles, now),
    replaceCard: new ReplacePuzzleCardUseCase(puzzles, words, questions),
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
    metrics: new GetDailyMetricsUseCase(metricsRepo, now),
  }
}

export type AdminWorld = ReturnType<typeof buildAdminWorld>
