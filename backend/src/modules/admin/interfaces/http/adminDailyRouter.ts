import { Router } from 'express'
import type { Response } from 'express'
import { z } from 'zod'
import type {
  AdminOverview,
  AdminPuzzleView,
  DailyEvent,
  DailyQuestion,
  DailyWord,
} from '../../application/ports/dailyAdmin'
import type {
  DailyContentAdminUseCase,
  DailyAdminReadsUseCase,
  DailyLaunchAdminUseCase,
  DailyPuzzleAdminUseCase,
} from '../../application/useCases/dailyAdmin'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import { requireUuidParam } from '../../../../shared/http/uuidParam'
import {
  AdminDailyConflictError,
  AdminDailyNotFoundError,
  InvalidAdminDailyError,
} from '../../domain/errors'
import {
  dailyAcceptedWordBodySchema,
  dailyDraftBodySchema,
  dailyMetricsQuerySchema,
  dailyEventCreateBodySchema,
  dailyEventUpdateBodySchema,
  dailyPublishBodySchema,
  dailyQuestionCreateBodySchema,
  dailyQuestionUpdateBodySchema,
  dailyReplaceCardBodySchema,
  dailyStartDateBodySchema,
  dailyWordCreateBodySchema,
  dailyWordUpdateBodySchema,
} from './schemas'

export interface AdminDailyRouterDeps {
  reads: DailyAdminReadsUseCase
  launch: DailyLaunchAdminUseCase
  puzzles: DailyPuzzleAdminUseCase
  content: DailyContentAdminUseCase
  authMiddleware: AuthMiddleware
}

function serializeLearnMore(learnMore: DailyWord['learnMore']) {
  return learnMore ? { kind: learnMore.kind, ref: learnMore.ref } : null
}

function serializeWord(word: DailyWord) {
  return {
    id: word.id,
    stable_key: word.stableKey,
    answer: word.answer,
    display: word.display,
    definition: word.definition,
    learn_more: serializeLearnMore(word.learnMore),
    category: word.category,
    scope: word.scope,
    active: word.active,
  }
}

function serializeQuestion(q: DailyQuestion) {
  return {
    id: q.id,
    stable_key: q.stableKey,
    question: q.question,
    options: q.options,
    correct_index: q.correctIndex,
    explanation: q.explanation,
    source_ref: q.sourceRef,
    learn_more: serializeLearnMore(q.learnMore),
    category: q.category,
    scope: q.scope,
    active: q.active,
  }
}

function serializeEvent(e: DailyEvent) {
  return {
    id: e.id,
    stable_key: e.stableKey,
    year: e.year,
    label: e.label,
    explanation: e.explanation,
    source_ref: e.sourceRef,
    learn_more: serializeLearnMore(e.learnMore),
    category: e.category,
    scope: e.scope,
    active: e.active,
  }
}

function serializeTally(t: AdminOverview['coverage']['word']) {
  return { total: t.total, brasil: t.brasil, fora: t.fora, by_category: t.byCategory }
}

function serializeOverview(o: AdminOverview) {
  return {
    status: o.status,
    start_date: o.startDate,
    today: o.today,
    can_change_start: o.canChangeStart,
    agenda_from: o.agendaFrom,
    ready_days_ahead: o.readyDaysAhead,
    published_days_ahead: o.publishedDaysAhead,
    min_days_to_schedule: o.minDaysToSchedule,
    low_cover_threshold: o.lowCoverThreshold,
    alerts: o.alerts,
    days: o.days.map((d) => ({
      number: d.number,
      date: d.date,
      published: d.published,
      origins: d.origins,
      word: d.word,
      question: d.question,
      events: d.events,
    })),
    coverage: {
      window_days: o.coverage.windowDays,
      word: serializeTally(o.coverage.word),
      trivia: serializeTally(o.coverage.trivia),
      timeline: serializeTally(o.coverage.timeline),
    },
    bank: {
      words: o.bank.words,
      questions: o.bank.questions,
      events: o.bank.events,
      accepted_extra: o.bank.acceptedExtra,
    },
  }
}

function serializePuzzle(p: AdminPuzzleView) {
  return {
    number: p.number,
    date: p.date,
    is_today_or_past: p.isTodayOrPast,
    published_at: p.publishedAt?.toISOString() ?? null,
    origins: p.origins,
    word: serializeWord(p.word),
    question: serializeQuestion(p.question),
    events: p.events.map(serializeEvent),
    correct_order: p.correctOrder,
    warnings: p.warnings,
  }
}

// snake_case do corpo -> campos do domínio, só os que vieram.
function learnMoreOf(body: {
  learn_more?: { kind: 'lesson' | 'glossary' | 'guide'; ref: string } | null
}) {
  return body.learn_more === undefined ? {} : { learnMore: body.learn_more }
}

// Painel do Diário (DI.5.1). Só admin. O gabarito aparece aqui porque o admin precisa revisar, e
// só aqui: as rotas públicas nunca o devolvem. Mudar a data da estreia pede senha recente (N.22);
// o resto é auditado mas reversível (revisão, edição) e não pede.
export function createAdminDailyRouter(deps: AdminDailyRouterDeps): Router {
  const router = Router()
  const adminOnly = [deps.authMiddleware.authenticate, deps.authMiddleware.requireRole('admin')]
  const recentAuth = deps.authMiddleware.requireRecentAuth()
  router.param('id', requireUuidParam)

  function sendDailyError(err: unknown, res: Response): void {
    if (err instanceof AdminDailyNotFoundError) {
      res.status(404).json({ error: err.message })
      return
    }
    if (err instanceof AdminDailyConflictError) {
      res.status(409).json({ error: err.message, code: err.code })
      return
    }
    if (err instanceof InvalidAdminDailyError) {
      res
        .status(422)
        .json({ error: err.message, code: 'invalid_daily_content', problems: err.problems })
      return
    }
    throw err
  }

  function badRequest(res: Response, message: string, error: z.ZodError): void {
    res.status(400).json({ error: message, details: z.flattenError(error) })
  }

  function parseNumber(value: unknown): number | null {
    const n = Number(value)
    return Number.isInteger(n) && n >= 1 ? n : null
  }

  router.get('/admin/daily', ...adminOnly, async (_req, res) => {
    res.status(200).json(serializeOverview(await deps.reads.overview()))
  })

  // Contadores do Diário (DI.7.1): um dia por linha, do mais recente ao mais antigo.
  router.get('/admin/daily/metrics', ...adminOnly, async (req, res) => {
    const parsed = dailyMetricsQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({ error: 'payload inválido', details: z.flattenError(parsed.error) })
      return
    }
    const days = await deps.reads.metrics(parsed.data.days)
    res.status(200).json({
      days: days.map((d) => ({
        date: d.date,
        anon_started: d.anonStarted,
        anon_completed: d.anonCompleted,
        logged_started: d.loggedStarted,
        logged_completed: d.loggedCompleted,
        signups: d.signups,
        logins: d.logins,
      })),
    })
  })

  router.post('/admin/daily/draft', ...adminOnly, async (req, res) => {
    const parsed = dailyDraftBodySchema.safeParse(req.body)
    if (!parsed.success) return badRequest(res, 'data de estreia inválida', parsed.error)
    try {
      const result = await deps.launch.prepareDraft(req.auth!.userId, parsed.data.start_date)
      res.status(200).json({
        start_date: result.startDate,
        created: result.created,
        warnings: result.warnings,
      })
    } catch (err) {
      sendDailyError(err, res)
    }
  })

  router.put('/admin/daily/start-date', ...adminOnly, recentAuth, async (req, res) => {
    const parsed = dailyStartDateBodySchema.safeParse(req.body)
    if (!parsed.success) return badRequest(res, 'data de estreia inválida', parsed.error)
    try {
      const result = await deps.launch.setStartDate(req.auth!.userId, parsed.data.start_date)
      res.status(200).json({
        start_date: result.startDate,
        status: result.status,
        published: result.published,
      })
    } catch (err) {
      sendDailyError(err, res)
    }
  })

  router.post('/admin/daily/puzzles/publish', ...adminOnly, async (req, res) => {
    const parsed = dailyPublishBodySchema.safeParse(req.body ?? {})
    if (!parsed.success) return badRequest(res, 'números de jogo inválidos', parsed.error)
    try {
      res.status(200).json(await deps.puzzles.publish(req.auth!.userId, parsed.data.numbers))
    } catch (err) {
      sendDailyError(err, res)
    }
  })

  router.get('/admin/daily/puzzles/:number', ...adminOnly, async (req, res) => {
    const number = parseNumber(req.params.number)
    if (number === null) {
      res.status(404).json({ error: 'jogo não encontrado' })
      return
    }
    try {
      res.status(200).json(serializePuzzle(await deps.reads.puzzle(number)))
    } catch (err) {
      sendDailyError(err, res)
    }
  })

  router.put('/admin/daily/puzzles/:number/card', ...adminOnly, async (req, res) => {
    const number = parseNumber(req.params.number)
    if (number === null) {
      res.status(404).json({ error: 'jogo não encontrado' })
      return
    }
    const parsed = dailyReplaceCardBodySchema.safeParse(req.body)
    if (!parsed.success) return badRequest(res, 'cartão inválido', parsed.error)
    const body = parsed.data
    const input =
      body.card === 'word'
        ? ({ card: 'word', wordId: body.word_id } as const)
        : body.card === 'question'
          ? ({ card: 'question', questionId: body.question_id } as const)
          : ({ card: 'timeline', eventIds: body.event_ids } as const)
    try {
      res
        .status(200)
        .json(
          await deps.puzzles.replaceCard(req.auth!.userId, number, input, body.confirm_published),
        )
    } catch (err) {
      sendDailyError(err, res)
    }
  })

  // ----- Palavras -----

  router.get('/admin/daily/words', ...adminOnly, async (_req, res) => {
    res.status(200).json({ words: (await deps.reads.words()).map(serializeWord) })
  })

  router.post('/admin/daily/words', ...adminOnly, async (req, res) => {
    const parsed = dailyWordCreateBodySchema.safeParse(req.body)
    if (!parsed.success) return badRequest(res, 'palavra inválida', parsed.error)
    try {
      const body = parsed.data
      const word = await deps.content.createWord(req.auth!.userId, {
        display: body.display,
        definition: body.definition,
        category: body.category,
        scope: body.scope,
        learnMore: body.learn_more,
      })
      res.status(201).json({ word: serializeWord(word) })
    } catch (err) {
      sendDailyError(err, res)
    }
  })

  router.patch('/admin/daily/words/:id', ...adminOnly, async (req, res) => {
    const parsed = dailyWordUpdateBodySchema.safeParse(req.body)
    if (!parsed.success) return badRequest(res, 'palavra inválida', parsed.error)
    const { confirm_published, ...body } = parsed.data
    try {
      const result = await deps.content.updateWord(
        req.auth!.userId,
        String(req.params.id),
        {
          display: body.display,
          definition: body.definition,
          category: body.category,
          scope: body.scope,
          active: body.active,
          ...learnMoreOf(body),
        },
        confirm_published,
      )
      res.status(200).json({
        word: serializeWord(result.item),
        affected_puzzles: result.affectedPuzzles,
      })
    } catch (err) {
      sendDailyError(err, res)
    }
  })

  router.get('/admin/daily/accepted-words', ...adminOnly, async (_req, res) => {
    res.status(200).json({ words: await deps.reads.acceptedExtra() })
  })

  router.post('/admin/daily/accepted-words', ...adminOnly, async (req, res) => {
    const parsed = dailyAcceptedWordBodySchema.safeParse(req.body)
    if (!parsed.success) return badRequest(res, 'palavra inválida', parsed.error)
    try {
      res.status(201).json(await deps.content.addAcceptedWord(req.auth!.userId, parsed.data.word))
    } catch (err) {
      sendDailyError(err, res)
    }
  })

  router.delete('/admin/daily/accepted-words/:word', ...adminOnly, async (req, res) => {
    try {
      res
        .status(200)
        .json(await deps.content.removeAcceptedWord(req.auth!.userId, String(req.params.word)))
    } catch (err) {
      sendDailyError(err, res)
    }
  })

  // ----- Perguntas -----

  router.get('/admin/daily/questions', ...adminOnly, async (_req, res) => {
    res.status(200).json({ questions: (await deps.reads.questions()).map(serializeQuestion) })
  })

  router.post('/admin/daily/questions', ...adminOnly, async (req, res) => {
    const parsed = dailyQuestionCreateBodySchema.safeParse(req.body)
    if (!parsed.success) return badRequest(res, 'pergunta inválida', parsed.error)
    const body = parsed.data
    try {
      const question = await deps.content.createQuestion(req.auth!.userId, {
        question: body.question,
        options: body.options,
        correctIndex: body.correct_index,
        explanation: body.explanation,
        sourceRef: body.source_ref,
        learnMore: body.learn_more,
        category: body.category,
        scope: body.scope,
      })
      res.status(201).json({ question: serializeQuestion(question) })
    } catch (err) {
      sendDailyError(err, res)
    }
  })

  router.patch('/admin/daily/questions/:id', ...adminOnly, async (req, res) => {
    const parsed = dailyQuestionUpdateBodySchema.safeParse(req.body)
    if (!parsed.success) return badRequest(res, 'pergunta inválida', parsed.error)
    const { confirm_published, ...body } = parsed.data
    try {
      const result = await deps.content.updateQuestion(
        req.auth!.userId,
        String(req.params.id),
        {
          question: body.question,
          options: body.options,
          correctIndex: body.correct_index,
          explanation: body.explanation,
          sourceRef: body.source_ref,
          category: body.category,
          scope: body.scope,
          active: body.active,
          ...learnMoreOf(body),
        },
        confirm_published,
      )
      res.status(200).json({
        question: serializeQuestion(result.item),
        affected_puzzles: result.affectedPuzzles,
      })
    } catch (err) {
      sendDailyError(err, res)
    }
  })

  // ----- Eventos -----

  router.get('/admin/daily/events', ...adminOnly, async (_req, res) => {
    res.status(200).json({ events: (await deps.reads.events()).map(serializeEvent) })
  })

  router.post('/admin/daily/events', ...adminOnly, async (req, res) => {
    const parsed = dailyEventCreateBodySchema.safeParse(req.body)
    if (!parsed.success) return badRequest(res, 'evento inválido', parsed.error)
    const body = parsed.data
    try {
      const event = await deps.content.createEvent(req.auth!.userId, {
        year: body.year,
        label: body.label,
        explanation: body.explanation,
        sourceRef: body.source_ref,
        learnMore: body.learn_more,
        category: body.category,
        scope: body.scope,
      })
      res.status(201).json({ event: serializeEvent(event) })
    } catch (err) {
      sendDailyError(err, res)
    }
  })

  router.patch('/admin/daily/events/:id', ...adminOnly, async (req, res) => {
    const parsed = dailyEventUpdateBodySchema.safeParse(req.body)
    if (!parsed.success) return badRequest(res, 'evento inválido', parsed.error)
    const { confirm_published, ...body } = parsed.data
    try {
      const result = await deps.content.updateEvent(
        req.auth!.userId,
        String(req.params.id),
        {
          year: body.year,
          label: body.label,
          explanation: body.explanation,
          sourceRef: body.source_ref,
          category: body.category,
          scope: body.scope,
          active: body.active,
          ...learnMoreOf(body),
        },
        confirm_published,
      )
      res.status(200).json({
        event: serializeEvent(result.item),
        affected_puzzles: result.affectedPuzzles,
      })
    } catch (err) {
      sendDailyError(err, res)
    }
  })

  return router
}
