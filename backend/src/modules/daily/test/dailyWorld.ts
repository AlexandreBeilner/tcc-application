import { createFakeTokenIssuer } from '../../auth/test/fakes/fakeTokenIssuer'
import { createAuthMiddleware } from '../../../shared/http/authMiddleware'
import { DailyProgressRecorder } from '../application/dailyProgressRecorder'
import { GetMyGameStateUseCase } from '../application/useCases/getMyGameState'
import { GetMyStatsUseCase } from '../application/useCases/getMyStats'
import type { DailyEvent, DailyPuzzle, DailyQuestion, DailyWord } from '../domain/content'
import { addDays } from '../domain/gameDay'
import { AnswerTimelineUseCase } from '../application/useCases/answerTimeline'
import { AnswerTriviaUseCase } from '../application/useCases/answerTrivia'
import { DailyGameLoader } from '../application/dailyGameLoader'
import { EvaluateWordGuessUseCase } from '../application/useCases/evaluateWordGuess'
import { GetGameUseCase } from '../application/useCases/getGame'
import { GetTodayUseCase } from '../application/useCases/getToday'
import { RecordDailyMetricUseCase } from '../application/useCases/recordDailyMetric'
import {
  createFakeAcceptedWordRepository,
  createFakeDailyEventRepository,
  createFakeDailyMetricsRepository,
  createFakeDailyResultRepository,
  createFakeStreakTracker,
  createFakeXpAwarder,
  createFakeDailyPuzzleRepository,
  createFakeDailyQuestionRepository,
  createFakeDailySettingsRepository,
  createFakeDailyWordRepository,
} from './fakes/fakeDailyRepositories'

export const WORD: DailyWord = {
  id: 'w1',
  stableKey: 'w1',
  answer: 'ACOES',
  display: 'AÇÕES',
  definition: 'Pedaços de uma empresa.',
  learnMore: { kind: 'glossary', ref: 'acao' },
  category: 'bolsa-e-acoes',
  scope: 'brasil',
  active: true,
}

export const QUESTION: DailyQuestion = {
  id: 'q1',
  stableKey: 'q1',
  question: 'Qual índice mede a inflação oficial?',
  options: ['IGP-M', 'IPCA', 'INPC', 'IPC-Fipe'],
  correctIndex: 1,
  explanation: 'O IPCA é a referência da meta de inflação.',
  sourceRef: 'IBGE',
  learnMore: null,
  category: 'juros-e-inflacao',
  scope: 'brasil',
  reviewedAt: null,
  active: true,
}

const event = (id: string, year: number, label: string): DailyEvent => ({
  id,
  stableKey: id,
  year,
  label,
  explanation: `Explicação de ${label}`,
  sourceRef: 'BCB',
  learnMore: null,
  category: 'planos-e-moeda',
  scope: 'brasil',
  reviewedAt: null,
  active: true,
})

export const EVENTS: DailyEvent[] = [
  event('ev-plano', 1994, 'Plano Real'),
  event('ev-cambio', 1999, 'Câmbio flutuante'),
  event('ev-crise', 2008, 'Crise financeira global'),
  event('ev-joesley', 2017, 'Joesley Day'),
]

// Ordem de exibição embaralhada de propósito.
export const DISPLAY_ORDER = ['ev-crise', 'ev-plano', 'ev-joesley', 'ev-cambio']
export const CORRECT_ORDER = ['ev-plano', 'ev-cambio', 'ev-crise', 'ev-joesley']

export const START = '2026-11-01'
export const ACCEPTED = ['ACOES', 'JUROS', 'CARRO', 'MORAL', 'AMOR', 'AMORES']

export interface WorldOptions {
  startDate: string | null
  // Quantos jogos materializar a partir da estreia (inclui dias futuros, de propósito).
  puzzleCount?: number
}

// Mundo mínimo do Diário com os repositórios falsos: estreia em `startDate` e jogos
// materializados a partir dela, todos com o mesmo conteúdo.
export function buildDailyWorld(options: WorldOptions) {
  const settings = createFakeDailySettingsRepository(options.startDate)
  const words = createFakeDailyWordRepository([WORD])
  const questions = createFakeDailyQuestionRepository([QUESTION])
  const events = createFakeDailyEventRepository(EVENTS)
  const acceptedWords = createFakeAcceptedWordRepository(ACCEPTED)
  const puzzles: DailyPuzzle[] = options.startDate
    ? Array.from({ length: options.puzzleCount ?? 5 }, (_, i) => ({
        number: i + 1,
        gameDate: addDays(options.startDate as string, i),
        wordId: WORD.id,
        questionId: QUESTION.id,
        timelineEventIds: DISPLAY_ORDER,
        wordOrigin: 'generated',
        questionOrigin: 'generated',
        timelineOrigin: 'generated',
        reviewedBy: null,
        reviewedAt: null,
        publishedAt: new Date(0),
      }))
    : []
  const puzzleRepo = createFakeDailyPuzzleRepository(puzzles)
  const loader = new DailyGameLoader(settings, puzzleRepo, words, questions, events)
  const results = createFakeDailyResultRepository()
  const xpAwarder = createFakeXpAwarder({
    xp: 50,
    level: 2,
    leveledUp: true,
    unlockedAchievements: [{ id: 'a1', name: 'Primeiro Diário', description: null }],
  })
  const streakTracker = createFakeStreakTracker()
  const recorder = new DailyProgressRecorder(results, xpAwarder, streakTracker)
  const metrics = createFakeDailyMetricsRepository()
  const tokenIssuer = createFakeTokenIssuer()
  const authMiddleware = createAuthMiddleware(tokenIssuer)
  return {
    settings,
    metrics,
    puzzleRepo,
    acceptedWords,
    loader,
    results,
    xpAwarder,
    streakTracker,
    authMiddleware,
    tokenFor: (userId: string) => tokenIssuer.issue({ sub: userId, role: 'user' }),
    getToday: new GetTodayUseCase(settings, loader),
    getGame: new GetGameUseCase(loader),
    evaluateWordGuess: new EvaluateWordGuessUseCase(loader, acceptedWords, recorder),
    answerTrivia: new AnswerTriviaUseCase(loader, recorder),
    answerTimeline: new AnswerTimelineUseCase(loader, recorder),
    getMyGameState: new GetMyGameStateUseCase(loader, results),
    getMyStats: new GetMyStatsUseCase(settings, results),
    recordMetric: new RecordDailyMetricUseCase(metrics),
  }
}
