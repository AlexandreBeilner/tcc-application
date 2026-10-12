import { Router } from 'express'
import type { Response } from 'express'
import { z } from 'zod'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import { requireUuidParam } from '../../../../shared/http/uuidParam'
import {
  AdminCatalogConflictError,
  AdminCatalogNotFoundError,
  InvalidAdminCatalogError,
} from '../../domain/errors'
import type {
  CatalogAchievement,
  CatalogMission,
} from '../../application/ports/gamificationCatalogAdmin'
import type { GetAdminRankingUseCase } from '../../application/useCases/getAdminRanking'
import type {
  CreateAchievementAdminUseCase,
  ListAchievementCatalogUseCase,
  ListMissionCatalogUseCase,
  UpdateAchievementAdminUseCase,
  UpdateMissionAdminUseCase,
} from '../../application/useCases/gamificationCatalog'
import {
  adminRankingQuerySchema,
  createAchievementBodySchema,
  updateAchievementBodySchema,
  updateMissionBodySchema,
} from './schemas'

export interface AdminGamificationRouterDeps {
  listAchievementCatalog: ListAchievementCatalogUseCase
  createAchievement: CreateAchievementAdminUseCase
  updateAchievement: UpdateAchievementAdminUseCase
  listMissionCatalog: ListMissionCatalogUseCase
  updateMission: UpdateMissionAdminUseCase
  getAdminRanking: GetAdminRankingUseCase
  authMiddleware: AuthMiddleware
}

function serializeAchievement(achievement: CatalogAchievement) {
  return {
    id: achievement.id,
    name: achievement.name,
    description: achievement.description,
    criteria_type: achievement.criteriaType,
    criteria_value: achievement.criteriaValue,
    is_active: achievement.isActive,
    is_rare: achievement.isRare,
    unlocked_count: achievement.unlockedCount,
  }
}

function serializeMission(mission: CatalogMission) {
  return {
    id: mission.id,
    key: mission.key,
    title: mission.title,
    description: mission.description,
    completion_criteria: mission.completionCriteria,
    xp_reward: mission.xpReward,
    is_active: mission.isActive,
    verification: mission.verification,
    completed_users: mission.completedUsers,
    completed_today: mission.completedToday,
  }
}

// Catálogo de conquistas e missões diárias e leitura do ranking (Fase N, tarefa N.19). Só admin.
// Editar o catálogo é auditado, mas não pede senha recente: não apaga dado de ninguém (desativar
// nunca remove o que o usuário já ganhou). O ranking é só leitura: é calculado na hora sobre a
// janela fixa, não há janela gravada pra fechar ou recalcular.
export function createAdminGamificationRouter(deps: AdminGamificationRouterDeps): Router {
  const router = Router()
  const adminOnly = [deps.authMiddleware.authenticate, deps.authMiddleware.requireRole('admin')]
  router.param('id', requireUuidParam)

  function sendCatalogError(err: unknown, res: Response): void {
    if (err instanceof AdminCatalogNotFoundError) {
      res.status(404).json({ error: err.message })
      return
    }
    if (err instanceof AdminCatalogConflictError) {
      res.status(409).json({ error: err.message })
      return
    }
    if (err instanceof InvalidAdminCatalogError) {
      res.status(422).json({ error: err.message, code: 'invalid_catalog_entry' })
      return
    }
    throw err
  }

  router.get('/admin/gamification/achievements', ...adminOnly, async (_req, res) => {
    const catalog = await deps.listAchievementCatalog.execute()
    res.status(200).json({
      achievements: catalog.achievements.map(serializeAchievement),
      criteria: catalog.criteria.map((c) => ({
        type: c.type,
        label: c.label,
        value_kind: c.valueKind,
      })),
    })
  })

  router.post('/admin/gamification/achievements', ...adminOnly, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }
    const parsed = createAchievementBodySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        error: 'informe nome, critério de desbloqueio e meta positiva',
        details: z.flattenError(parsed.error),
      })
      return
    }
    try {
      const created = await deps.createAchievement.execute(req.auth.userId, {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        criteriaType: parsed.data.criteria_type,
        criteriaValue: parsed.data.criteria_value,
      })
      res.status(201).json(serializeAchievement(created))
    } catch (err) {
      sendCatalogError(err, res)
    }
  })

  router.patch('/admin/gamification/achievements/:id', ...adminOnly, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }
    const parsed = updateAchievementBodySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        error: 'campos da conquista inválidos',
        details: z.flattenError(parsed.error),
      })
      return
    }
    const body = parsed.data
    try {
      const updated = await deps.updateAchievement.execute(req.auth.userId, String(req.params.id), {
        name: body.name,
        description: body.description,
        criteriaType: body.criteria_type,
        criteriaValue: body.criteria_value,
        isActive: body.is_active,
        isRare: body.is_rare,
      })
      res.status(200).json(serializeAchievement(updated))
    } catch (err) {
      sendCatalogError(err, res)
    }
  })

  router.get('/admin/gamification/missions', ...adminOnly, async (_req, res) => {
    const missions = await deps.listMissionCatalog.execute()
    res.status(200).json({ missions: missions.map(serializeMission) })
  })

  router.patch('/admin/gamification/missions/:id', ...adminOnly, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }
    const parsed = updateMissionBodySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        error: 'campos da missão inválidos',
        details: z.flattenError(parsed.error),
      })
      return
    }
    const body = parsed.data
    try {
      const updated = await deps.updateMission.execute(req.auth.userId, String(req.params.id), {
        title: body.title,
        description: body.description,
        xpReward: body.xp_reward,
        isActive: body.is_active,
      })
      res.status(200).json(serializeMission(updated))
    } catch (err) {
      sendCatalogError(err, res)
    }
  })

  router.get('/admin/gamification/ranking', ...adminOnly, async (req, res) => {
    const parsed = adminRankingQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({
        error: 'parâmetros do ranking inválidos',
        details: z.flattenError(parsed.error),
      })
      return
    }
    const ranking = await deps.getAdminRanking.execute(parsed.data)
    res.status(200).json({
      window: ranking.window,
      window_start: ranking.windowStart?.toISOString() ?? null,
      window_end: ranking.windowEnd?.toISOString() ?? null,
      criterion: ranking.criterion,
      entries: ranking.entries.map((entry) => ({
        position: entry.position,
        user_id: entry.userId,
        username: entry.username,
        level: entry.level,
        xp: entry.xp,
        profitability_pct: entry.profitabilityPct,
      })),
      page: ranking.page,
      page_size: ranking.pageSize,
      total_entries: ranking.totalEntries,
      total_pages: ranking.totalPages,
    })
  })

  return router
}
