import { Router } from 'express'
import type { RequestHandler, Response } from 'express'
import { z } from 'zod'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import { requireUuidParam } from '../../../../shared/http/uuidParam'
import {
  AdminAnnouncementConflictError,
  AdminAnnouncementNotFoundError,
  InvalidAdminAnnouncementError,
  TradingHaltConflictError,
  TradingHaltNotFoundError,
  TradingHaltRejectedError,
} from '../../domain/errors'
import type { AdminAnnouncement } from '../../application/ports/announcementAdmin'
import type {
  CreateAdminAnnouncementUseCase,
  EndAdminAnnouncementUseCase,
  ListAdminAnnouncementsUseCase,
  StartMaintenanceUseCase,
  UpdateAdminAnnouncementUseCase,
} from '../../application/useCases/announcements'
import {
  createAnnouncementBodySchema,
  startMaintenanceBodySchema,
  updateAnnouncementBodySchema,
} from './schemas'

export interface AdminAnnouncementsRouterDeps {
  listAnnouncements: ListAdminAnnouncementsUseCase
  createAnnouncement: CreateAdminAnnouncementUseCase
  updateAnnouncement: UpdateAdminAnnouncementUseCase
  endAnnouncement: EndAdminAnnouncementUseCase
  startMaintenance: StartMaintenanceUseCase
  authMiddleware: AuthMiddleware
}

export function serializeAnnouncement(a: AdminAnnouncement) {
  return {
    id: a.id,
    title: a.title,
    body: a.body,
    severity: a.severity,
    kind: a.kind,
    dismissible: a.dismissible,
    notify_by_email: a.notifyByEmail,
    starts_at: a.startsAt.toISOString(),
    ends_at: a.endsAt?.toISOString() ?? null,
    linked_halt_id: a.linkedHaltId,
    status: a.status,
    created_at: a.createdAt.toISOString(),
  }
}

// Comunicados globais e modo de manutenção (Fase N, tarefa N.20). Só admin. Criar, editar e
// encerrar um comunicado é auditado e não pede senha recente (não apaga dado de ninguém);
// ligar a pausa de negociação junto com a manutenção pede (é a mesma ação destrutiva da N.9).
export function createAdminAnnouncementsRouter(deps: AdminAnnouncementsRouterDeps): Router {
  const router = Router()
  const adminOnly = [deps.authMiddleware.authenticate, deps.authMiddleware.requireRole('admin')]
  const recentAuth = deps.authMiddleware.requireRecentAuth()
  router.param('id', requireUuidParam)

  // Só a manutenção que pausa o mercado exige senha recente; o corpo precisa ser lido antes.
  const recentAuthWhenPausing: RequestHandler = (req, res, next) => {
    if (req.body?.pause_trading === true) {
      recentAuth(req, res, next)
      return
    }
    next()
  }

  function sendError(err: unknown, res: Response): void {
    if (err instanceof AdminAnnouncementNotFoundError) {
      res.status(404).json({ error: err.message })
      return
    }
    if (
      err instanceof AdminAnnouncementConflictError ||
      err instanceof TradingHaltConflictError ||
      err instanceof TradingHaltNotFoundError
    ) {
      res.status(409).json({ error: err.message })
      return
    }
    if (err instanceof InvalidAdminAnnouncementError || err instanceof TradingHaltRejectedError) {
      res.status(422).json({ error: err.message })
      return
    }
    throw err
  }

  router.get('/admin/announcements', ...adminOnly, async (_req, res) => {
    const announcements = await deps.listAnnouncements.execute()
    res.status(200).json({ announcements: announcements.map(serializeAnnouncement) })
  })

  router.post('/admin/announcements', ...adminOnly, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }
    const parsed = createAnnouncementBodySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        error: 'dados do comunicado inválidos',
        details: z.flattenError(parsed.error),
      })
      return
    }
    const { starts_at, ends_at, notify_by_email, ...rest } = parsed.data
    try {
      const created = await deps.createAnnouncement.execute(req.auth.userId, {
        ...rest,
        notifyByEmail: notify_by_email,
        startsAt: starts_at ? new Date(starts_at) : new Date(),
        endsAt: ends_at ? new Date(ends_at) : null,
      })
      res.status(201).json(serializeAnnouncement(created))
    } catch (err) {
      sendError(err, res)
    }
  })

  router.patch('/admin/announcements/:id', ...adminOnly, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }
    const parsed = updateAnnouncementBodySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        error: 'dados do comunicado inválidos',
        details: z.flattenError(parsed.error),
      })
      return
    }
    const { starts_at, ends_at, ...rest } = parsed.data
    try {
      const updated = await deps.updateAnnouncement.execute(
        req.auth.userId,
        req.params.id as string,
        {
          ...rest,
          ...(starts_at !== undefined ? { startsAt: new Date(starts_at) } : {}),
          ...(ends_at !== undefined ? { endsAt: ends_at === null ? null : new Date(ends_at) } : {}),
        },
      )
      res.status(200).json(serializeAnnouncement(updated))
    } catch (err) {
      sendError(err, res)
    }
  })

  router.post('/admin/announcements/:id/end', ...adminOnly, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }
    try {
      const result = await deps.endAnnouncement.execute(req.auth.userId, req.params.id as string)
      res.status(200).json({
        announcement: serializeAnnouncement(result.announcement),
        outcome: result.outcome,
        halt_lifted: result.haltLifted,
      })
    } catch (err) {
      sendError(err, res)
    }
  })

  router.post('/admin/maintenance', ...adminOnly, recentAuthWhenPausing, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }
    const parsed = startMaintenanceBodySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        error: 'dados da manutenção inválidos',
        details: z.flattenError(parsed.error),
      })
      return
    }
    try {
      const created = await deps.startMaintenance.execute(req.auth.userId, {
        title: parsed.data.title,
        body: parsed.data.body,
        startsAt: parsed.data.starts_at ? new Date(parsed.data.starts_at) : undefined,
        endsAt: parsed.data.ends_at ? new Date(parsed.data.ends_at) : null,
        pauseTrading: parsed.data.pause_trading,
        notifyByEmail: parsed.data.notify_by_email,
      })
      res.status(201).json(serializeAnnouncement(created))
    } catch (err) {
      sendError(err, res)
    }
  })

  return router
}
