import { Router } from 'express'
import type { Response } from 'express'
import { z } from 'zod'
import type { AuthMiddleware } from '../../../../shared/http/authMiddleware'
import { requireUuidParam } from '../../../../shared/http/uuidParam'
import {
  AdminAssemblyConflictError,
  AdminAssemblyNotFoundError,
  InvalidAdminAssemblyError,
} from '../../domain/errors'
import type {
  AdminAssemblyDetailView,
  AdminAssemblyRow,
  AgendaTemplateAdminItem,
  AssemblyPauseView,
  AssemblySettingRow,
} from '../../application/ports/assemblyAdmin'
import type {
  CreateAgendaTemplateAdminUseCase,
  GetAssemblyAdminDetailUseCase,
  LiftAssemblyPauseAdminUseCase,
  ListAgendaTemplatesAdminUseCase,
  ListAssembliesAdminUseCase,
  ListAssemblyPausesAdminUseCase,
  ListAssemblySettingsAdminUseCase,
  PauseAssembliesAdminUseCase,
  ResetAssemblySettingAdminUseCase,
  SetAgendaTemplateActiveAdminUseCase,
  UpdateAgendaTemplateAdminUseCase,
  UpdateAssemblySettingAdminUseCase,
} from '../../application/useCases/assemblyAdmin'
import {
  agendaTemplateContentSchema,
  assemblyListQuerySchema,
  assemblySettingKeySchema,
  createAgendaTemplateBodySchema,
  pauseAssembliesBodySchema,
  setAgendaTemplateActiveBodySchema,
  updateAssemblySettingBodySchema,
} from './schemas'

export interface AdminAssembliesRouterDeps {
  listAssemblies: ListAssembliesAdminUseCase
  getAssembly: GetAssemblyAdminDetailUseCase
  listPauses: ListAssemblyPausesAdminUseCase
  pauseAssemblies: PauseAssembliesAdminUseCase
  liftPause: LiftAssemblyPauseAdminUseCase
  listSettings: ListAssemblySettingsAdminUseCase
  updateSetting: UpdateAssemblySettingAdminUseCase
  resetSetting: ResetAssemblySettingAdminUseCase
  listTemplates: ListAgendaTemplatesAdminUseCase
  createTemplate: CreateAgendaTemplateAdminUseCase
  updateTemplate: UpdateAgendaTemplateAdminUseCase
  setTemplateActive: SetAgendaTemplateActiveAdminUseCase
  authMiddleware: AuthMiddleware
}

function serializeRow(a: AdminAssemblyRow) {
  return {
    id: a.id,
    kind: a.kind,
    subject_ref: a.subjectRef,
    subject_label: a.subjectLabel,
    title: a.title,
    status: a.status,
    opens_at: a.opensAt,
    closes_at: a.closesAt,
    effect_applies_at: a.effectAppliesAt,
    effect_applied_at: a.effectAppliedAt,
    outcome: a.outcome,
    outcome_reason: a.outcomeReason,
    voter_count: a.voterCount,
    winning_option_id: a.winningOptionId,
    min_voters: a.minVoters,
    effect_pending: a.effectPending,
    paused: a.paused,
    declaration_id: a.declarationId,
    dividend_on_hold: a.dividendOnHold,
  }
}

function serializeDetail(d: AdminAssemblyDetailView) {
  return {
    assembly: serializeRow(d.assembly),
    options: d.options,
    min_voters: d.minVoters,
    counted_voters: d.countedVoters,
    holders: d.holders,
    votes: d.votes.map((v) => ({
      user_id: v.userId,
      username: v.username,
      name: v.name,
      option_id: v.optionId,
      weight: v.weight,
      eligible: v.eligible,
      created_at: v.createdAt,
      updated_at: v.updatedAt,
    })),
  }
}

function serializePause(p: AssemblyPauseView) {
  return {
    id: p.id,
    scope: p.scope === 'global' ? 'global' : 'company',
    company_id: p.subjectRef,
    reason: p.reason,
    created_by: p.createdBy,
    created_at: p.createdAt,
    lifted_at: p.liftedAt,
    lifted_by: p.liftedBy,
  }
}

function serializeSetting(s: AssemblySettingRow) {
  return {
    key: s.key,
    value: s.value,
    default: s.default,
    min: s.min,
    max: s.max,
    overridden: s.overridden,
    updated_by: s.updatedBy,
    updated_at: s.updatedAt,
  }
}

function serializeTemplate(t: AgendaTemplateAdminItem) {
  return {
    key: t.key,
    purpose: t.purpose,
    sector: t.sector,
    title: t.title,
    description: t.description,
    options: t.options,
    active: t.active,
    created_at: t.createdAt,
    usage: { assemblies: t.usage.assemblies, active_proposals: t.usage.activeProposals },
  }
}

// Painel das assembleias (MO.6.8): pausa (global ou por empresa), leitura com voto por pessoa,
// parâmetros e catálogo de pautas. Funciona com o recurso desligado (`ASSEMBLIES_ENABLED`): é
// justamente antes de ligar que se calibra. Escrita sempre auditada; leitura não (exceção
// deliberada do painel, como o patrimônio).
export function createAdminAssembliesRouter(deps: AdminAssembliesRouterDeps): Router {
  const router = Router()
  const adminOnly = [deps.authMiddleware.authenticate, deps.authMiddleware.requireRole('admin')]
  // Pausar é ação de impacto: exige senha conferida há pouco (N.22), como a pausa de negociação.
  const recentAuth = deps.authMiddleware.requireRecentAuth()
  router.param('id', requireUuidParam)

  // As rotas fixas vêm antes de `/:id`.
  router.get('/admin/assemblies', ...adminOnly, async (req, res) => {
    const query = assemblyListQuerySchema.safeParse(req.query)
    if (!query.success) {
      res.status(400).json({ error: 'status inválido', details: z.flattenError(query.error) })
      return
    }
    const rows = await deps.listAssemblies.execute(query.data.status)
    res.status(200).json({ assemblies: rows.map(serializeRow) })
  })

  router.get('/admin/assemblies/pauses', ...adminOnly, async (_req, res) => {
    const { active, recent } = await deps.listPauses.execute()
    res.status(200).json({ active: active.map(serializePause), recent: recent.map(serializePause) })
  })

  router.post('/admin/assemblies/pauses', ...adminOnly, recentAuth, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }
    const body = pauseAssembliesBodySchema.safeParse(req.body)
    if (!body.success) {
      res
        .status(400)
        .json({ error: 'dados da pausa inválidos', details: z.flattenError(body.error) })
      return
    }
    try {
      const pause = await deps.pauseAssemblies.execute(req.auth.userId, {
        scope: body.data.scope === 'global' ? 'global' : 'subject',
        subjectRef: body.data.company_id,
        reason: body.data.reason,
      })
      res.status(201).json(serializePause(pause))
    } catch (err) {
      sendAssemblyAdminError(err, res)
    }
  })

  router.post('/admin/assemblies/pauses/:id/lift', ...adminOnly, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }
    try {
      const pause = await deps.liftPause.execute(req.auth.userId, req.params.id as string)
      res.status(200).json(serializePause(pause))
    } catch (err) {
      sendAssemblyAdminError(err, res)
    }
  })

  router.get('/admin/assemblies/settings', ...adminOnly, async (_req, res) => {
    const settings = await deps.listSettings.execute()
    res.status(200).json({ settings: settings.map(serializeSetting) })
  })

  router.put('/admin/assemblies/settings/:key', ...adminOnly, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }
    const key = assemblySettingKeySchema.safeParse(req.params.key)
    if (!key.success) {
      res.status(404).json({ error: 'parâmetro desconhecido' })
      return
    }
    const body = updateAssemblySettingBodySchema.safeParse(req.body)
    if (!body.success) {
      res
        .status(400)
        .json({ error: 'value deve ser um inteiro', details: z.flattenError(body.error) })
      return
    }
    try {
      const settings = await deps.updateSetting.execute(req.auth.userId, key.data, body.data.value)
      res.status(200).json({ settings: settings.map(serializeSetting) })
    } catch (err) {
      sendAssemblyAdminError(err, res)
    }
  })

  router.delete('/admin/assemblies/settings/:key', ...adminOnly, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }
    const key = assemblySettingKeySchema.safeParse(req.params.key)
    if (!key.success) {
      res.status(404).json({ error: 'parâmetro desconhecido' })
      return
    }
    try {
      const settings = await deps.resetSetting.execute(req.auth.userId, key.data)
      res.status(200).json({ settings: settings.map(serializeSetting) })
    } catch (err) {
      sendAssemblyAdminError(err, res)
    }
  })

  router.get('/admin/assemblies/agenda-templates', ...adminOnly, async (_req, res) => {
    const templates = await deps.listTemplates.execute()
    res.status(200).json({ templates: templates.map(serializeTemplate) })
  })

  router.post('/admin/assemblies/agenda-templates', ...adminOnly, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }
    const body = createAgendaTemplateBodySchema.safeParse(req.body)
    if (!body.success) {
      res
        .status(400)
        .json({ error: 'dados da pauta inválidos', details: z.flattenError(body.error) })
      return
    }
    const { key, ...content } = body.data
    try {
      res
        .status(201)
        .json(serializeTemplate(await deps.createTemplate.execute(req.auth.userId, key, content)))
    } catch (err) {
      sendAssemblyAdminError(err, res)
    }
  })

  router.put('/admin/assemblies/agenda-templates/:key', ...adminOnly, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }
    const body = agendaTemplateContentSchema.safeParse(req.body)
    if (!body.success) {
      res
        .status(400)
        .json({ error: 'dados da pauta inválidos', details: z.flattenError(body.error) })
      return
    }
    try {
      const updated = await deps.updateTemplate.execute(
        req.auth.userId,
        req.params.key as string,
        body.data,
      )
      res.status(200).json(serializeTemplate(updated))
    } catch (err) {
      sendAssemblyAdminError(err, res)
    }
  })

  router.post('/admin/assemblies/agenda-templates/:key/active', ...adminOnly, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'token ausente' })
      return
    }
    const body = setAgendaTemplateActiveBodySchema.safeParse(req.body)
    if (!body.success) {
      res
        .status(400)
        .json({ error: 'active deve ser booleano', details: z.flattenError(body.error) })
      return
    }
    try {
      const updated = await deps.setTemplateActive.execute(
        req.auth.userId,
        req.params.key as string,
        body.data.active,
      )
      res.status(200).json(serializeTemplate(updated))
    } catch (err) {
      sendAssemblyAdminError(err, res)
    }
  })

  router.get('/admin/assemblies/:id', ...adminOnly, async (req, res) => {
    try {
      res.status(200).json(serializeDetail(await deps.getAssembly.execute(req.params.id as string)))
    } catch (err) {
      sendAssemblyAdminError(err, res)
    }
  })

  return router
}

function sendAssemblyAdminError(err: unknown, res: Response): void {
  if (err instanceof AdminAssemblyNotFoundError) {
    res.status(404).json({ error: err.message })
    return
  }
  if (err instanceof AdminAssemblyConflictError) {
    res.status(409).json({ error: err.message })
    return
  }
  if (err instanceof InvalidAdminAssemblyError) {
    res.status(422).json({ error: err.message })
    return
  }
  throw err
}
