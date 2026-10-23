import { createFakeTokenIssuer } from '../../auth/test/fakes/fakeTokenIssuer'
import { createAuthMiddleware } from '../../../shared/http/authMiddleware'
import { DailyProgressRecorder } from '../application/dailyProgressRecorder'
import { GetMyGameStateUseCase } from '../application/useCases/getMyGameState'
import { GetMyStatsUseCase } from '../application/useCases/getMyStats'
import type { DailyPuzzle, DailyQuestion, DailyWord } from '../domain/content'
import { addDays } from '../domain/gameDay'
import { AnswerTriviaUseCase } from '../application/useCases/answerTrivia'
import { DailyGameLoader } from '../application/dailyGameLoader'
import { EvaluateWordGuessUseCase } from '../application/useCases/evaluateWordGuess'
import { GetArchiveUseCase } from '../application/useCases/getArchive'
import { GetGameUseCase } from '../application/useCases/getGame'
import { GetTodayUseCase } from '../application/useCases/getToday'
import { RecordDailyMetricUseCase } from '../application/useCases/recordDailyMetric'
import {
  createFakeAcceptedWordRepository,
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
  const acceptedWords = createFakeAcceptedWordRepository(ACCEPTED)
  const puzzles: DailyPuzzle[] = options.startDate
    ? Array.from({ length: options.puzzleCount ?? 5 }, (_, i) => ({
        number: i + 1,
        gameDate: addDays(options.startDate as string, i),
        wordId: WORD.id,
        questionId: QUESTION.id,
        wordOrigin: 'generated',
        questionOrigin: 'generated',
        reviewedBy: null,
        reviewedAt: null,
        publishedAt: new Date(0),
      }))
    : []
  const puzzleRepo = createFakeDailyPuzzleRepository(puzzles)
  const loader = new DailyGameLoader(settings, puzzleRepo, words, questions)
  const results = createFakeDailyResultRepository()
  const xpAwarder = createFakeXpAwarder({
    xp: 50,
    level: 2,
    leveledUp: true,
    unlockedAchievements: [{ id: 'a1', name: 'Primeiro Diário', description: null }],
  })
  const streakTracker = createFakeStreakTracker()
  const completedUserIds: string[] = []
  const recorder = new DailyProgressRecorder(results, xpAwarder, streakTracker, {
    onDailyCompleted: async (userId) => {
      completedUserIds.push(userId)
    },
  })
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
    completedUserIds,
    authMiddleware,
    tokenFor: (userId: string) => tokenIssuer.issue({ sub: userId, role: 'user' }),
    getToday: new GetTodayUseCase(settings, loader),
    getGame: new GetGameUseCase(loader),
    getArchive: new GetArchiveUseCase(settings, loader),
    evaluateWordGuess: new EvaluateWordGuessUseCase(loader, acceptedWords, recorder),
    answerTrivia: new AnswerTriviaUseCase(loader, recorder),
    getMyGameState: new GetMyGameStateUseCase(loader, results),
    getMyStats: new GetMyStatsUseCase(settings, results),
    recordMetric: new RecordDailyMetricUseCase(metrics),
  }
}
