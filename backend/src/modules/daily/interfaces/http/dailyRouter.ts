import { Router, type RequestHandler, type Response } from 'express'
import { z } from 'zod'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import { noStore } from '../../../../shared/http/noStore'
import type { AnswerTimelineUseCase } from '../../application/useCases/answerTimeline'
import type { AnswerTriviaUseCase } from '../../application/useCases/answerTrivia'
import type { EvaluateWordGuessUseCase } from '../../application/useCases/evaluateWordGuess'
import type { GetMyGameStateUseCase } from '../../application/useCases/getMyGameState'
import type { GetMyStatsUseCase } from '../../application/useCases/getMyStats'
import type { GetGameUseCase } from '../../application/useCases/getGame'
import type { GetTodayUseCase } from '../../application/useCases/getToday'
import {
  AttemptRequiredError,
  CardAlreadyAnsweredError,
  DailyGameNotFoundError,
  DailyGameUnavailableError,
  DailyNotStartedError,
  InvalidChoiceError,
  InvalidGuessError,
  InvalidOrderError,
  WordNotAcceptedError,
} from '../../domain/errors'
import { timelineAnswerBodySchema, triviaAnswerBodySchema, wordGuessBodySchema } from './schemas'

export interface DailyRouterDeps {
  getToday: GetTodayUseCase
  getGame: GetGameUseCase
  evaluateWordGuess: EvaluateWordGuessUseCase
  answerTrivia: AnswerTriviaUseCase
  answerTimeline: AnswerTimelineUseCase
  getMyGameState: GetMyGameStateUseCase
  getMyStats: GetMyStatsUseCase
  authMiddleware: AuthMiddleware
  // Relógio injetável: os testes da virada do dia (20h59 e 21h00 de Brasília) precisam dele.
  now?: () => Date
}

// Número do jogo na URL. Qualquer coisa que não seja um inteiro positivo responde como jogo
// inexistente (404), o mesmo erro do jogo futuro.
function parseNumber(raw: string | string[] | undefined): number | null {
  if (typeof raw !== 'string' || !/^\d{1,9}$/.test(raw)) return null
  const n = Number(raw)
  return n >= 1 ? n : null
}

function handleError(err: unknown, res: Response): boolean {
  if (err instanceof DailyGameNotFoundError) {
    res.status(404).json({ error: 'not_found' })
  } else if (err instanceof DailyNotStartedError) {
    res.status(409).json({
      error: 'not_started',
      startDate: err.startDate,
      startsAt: err.startsAt.toISOString(),
    })
  } else if (err instanceof DailyGameUnavailableError) {
    res.status(503).json({ error: 'game_unavailable' })
  } else if (err instanceof InvalidGuessError) {
    res.status(422).json({ error: 'invalid_guess', reason: err.reason })
  } else if (err instanceof WordNotAcceptedError) {
    res.status(422).json({ error: 'word_not_accepted' })
  } else if (err instanceof InvalidChoiceError) {
    res.status(422).json({ error: 'invalid_choice' })
  } else if (err instanceof CardAlreadyAnsweredError) {
    res.status(409).json({ error: 'already_answered' })
  } else if (err instanceof AttemptRequiredError) {
    res.status(400).json({ error: 'attempt_required' })
  } else if (err instanceof InvalidOrderError) {
    res.status(422).json({ error: 'invalid_order' })
  } else {
    return false
  }
  return true
}

// Rotas do Diário. As de jogo servem quem não tem conta (sem login o servidor não guarda estado,
// DI.2.1) e quem tem (a mesma rota grava o jogo e concede XP, DI.2.2): com `Authorization` o token
// precisa ser válido (um token ruim é 401, nunca vira anônimo em silêncio). Nenhuma resposta traz
// o gabarito antes de o cartão terminar (DP3).
export function createDailyRouter(deps: DailyRouterDeps): Router {
  const router = Router()
  const clock = deps.now ?? (() => new Date())
  const optionalAuth: RequestHandler = (req, res, next) =>
    req.headers.authorization ? deps.authMiddleware.authenticate(req, res, next) : next()
  const requireAuth = deps.authMiddleware.authenticate

  router.use('/daily', noStore)

  router.get('/daily/today', async (_req, res) => {
    try {
      res.status(200).json(await deps.getToday.execute({ now: clock() }))
    } catch (err) {
      if (!handleError(err, res)) throw err
    }
  })

  router.get('/daily/me/stats', requireAuth, async (req, res) => {
    res.status(200).json(await deps.getMyStats.execute({ userId: req.auth!.userId, now: clock() }))
  })

  router.get('/daily/:number/me', requireAuth, async (req, res) => {
    const number = parseNumber(req.params.number)
    if (number === null) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    try {
      res
        .status(200)
        .json(await deps.getMyGameState.execute({ userId: req.auth!.userId, number, now: clock() }))
    } catch (err) {
      if (!handleError(err, res)) throw err
    }
  })

  router.get('/daily/:number', async (req, res) => {
    const number = parseNumber(req.params.number)
    if (number === null) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    try {
      res.status(200).json(await deps.getGame.execute({ number, now: clock() }))
    } catch (err) {
      if (!handleError(err, res)) throw err
    }
  })

  router.post('/daily/:number/word/guess', optionalAuth, async (req, res) => {
    const number = parseNumber(req.params.number)
    if (number === null) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    const parsed = wordGuessBodySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'payload inválido', details: z.flattenError(parsed.error) })
      return
    }
    try {
      res.status(200).json(
        await deps.evaluateWordGuess.execute({
          number,
          ...parsed.data,
          userId: req.auth?.userId,
          now: clock(),
        }),
      )
    } catch (err) {
      if (!handleError(err, res)) throw err
    }
  })

  router.post('/daily/:number/cards/:card/answer', optionalAuth, async (req, res) => {
    const number = parseNumber(req.params.number)
    if (number === null) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    try {
      if (req.params.card === 'trivia') {
        const parsed = triviaAnswerBodySchema.safeParse(req.body)
        if (!parsed.success) {
          res.status(400).json({ error: 'payload inválido', details: z.flattenError(parsed.error) })
          return
        }
        res.status(200).json(
          await deps.answerTrivia.execute({
            number,
            ...parsed.data,
            userId: req.auth?.userId,
            now: clock(),
          }),
        )
      } else if (req.params.card === 'timeline') {
        const parsed = timelineAnswerBodySchema.safeParse(req.body)
        if (!parsed.success) {
          res.status(400).json({ error: 'payload inválido', details: z.flattenError(parsed.error) })
          return
        }
        res.status(200).json(
          await deps.answerTimeline.execute({
            number,
            ...parsed.data,
            userId: req.auth?.userId,
            now: clock(),
          }),
        )
      } else {
        // `word` tem rota própria; qualquer outro nome não é cartão.
        res.status(404).json({ error: 'not_found' })
      }
    } catch (err) {
      if (!handleError(err, res)) throw err
    }
  })

  return router
}
