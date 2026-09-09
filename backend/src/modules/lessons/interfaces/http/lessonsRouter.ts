import { Router } from 'express'
import { z } from 'zod'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import {
  InvalidMicroDecisionOptionError,
  LessonLockedError,
  LessonNotCompletedError,
  LessonNotFoundError,
} from '../../domain/errors'
import type { AdvanceLessonUseCase } from '../../application/useCases/advanceLesson'
import type { GetLessonUseCase } from '../../application/useCases/getLesson'
import type { GetTrackMapUseCase } from '../../application/useCases/getTrackMap'
import type { ReviewLessonUseCase } from '../../application/useCases/reviewLesson'
import { advanceLessonBodySchema } from './schemas'

export interface LessonsRouterDeps {
  getTrackMap: GetTrackMapUseCase
  getLesson: GetLessonUseCase
  advanceLesson: AdvanceLessonUseCase
  reviewLesson: ReviewLessonUseCase
  authMiddleware: AuthMiddleware
}

export function createLessonsRouter(deps: LessonsRouterDeps): Router {
  const router = Router()

  router.get('/lessons', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }

    const lessons = await deps.getTrackMap.execute({ userId: req.auth.userId })
    res.status(200).json({ lessons })
  })

  router.get('/lessons/:id', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }

    try {
      const lesson = await deps.getLesson.execute({
        userId: req.auth.userId,
        // Express 5 infere `params` como `string | string[]` quando a rota
        // tem mais de um handler (aqui: authMiddleware + handler) — `:id`
        // nunca repete segmento nesta rota, então é sempre string em tempo
        // de execução.
        lessonId: req.params.id as string,
      })
      res.status(200).json({ lesson })
    } catch (err) {
      if (err instanceof LessonNotFoundError || err instanceof LessonLockedError) {
        res.status(404).json({ error: err.message })
        return
      }
      throw err
    }
  })

  router.post('/lessons/:id/progress', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }

    const parsed = advanceLessonBodySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'payload inválido', details: z.flattenError(parsed.error) })
      return
    }

    try {
      const result = await deps.advanceLesson.execute({
        userId: req.auth.userId,
        lessonId: req.params.id as string,
        step: parsed.data.step,
        selectedOption: parsed.data.selectedOption,
      })
      res.status(200).json(result)
    } catch (err) {
      if (err instanceof LessonNotFoundError || err instanceof LessonLockedError) {
        res.status(404).json({ error: err.message })
        return
      }
      if (err instanceof InvalidMicroDecisionOptionError) {
        res.status(400).json({ error: err.message })
        return
      }
      throw err
    }
  })

  router.post('/lessons/:id/review', deps.authMiddleware.authenticate, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }

    try {
      await deps.reviewLesson.execute({
        userId: req.auth.userId,
        lessonId: req.params.id as string,
      })
      res.status(200).json({ status: 'reviewed' })
    } catch (err) {
      if (err instanceof LessonNotFoundError) {
        res.status(404).json({ error: err.message })
        return
      }
      if (err instanceof LessonNotCompletedError) {
        res.status(422).json({ error: err.message })
        return
      }
      throw err
    }
  })

  return router
}
