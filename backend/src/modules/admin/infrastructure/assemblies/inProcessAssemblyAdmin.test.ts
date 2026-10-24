import express from 'express'
import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import { AssemblyKindRegistry } from '../../../assemblies/application/assemblyKinds'
import { AssemblySettingsService } from '../../../assemblies/application/assemblySettingsService'
import {
  GetAdminAssemblyDetailUseCase,
  ListAdminAssembliesUseCase,
} from '../../../assemblies/application/useCases/adminAssemblies'
import {
  CreateAgendaTemplateUseCase,
  ListAgendaTemplatesAdminUseCase as ListTemplates,
  SetAgendaTemplateActiveUseCase,
  UpdateAgendaTemplateUseCase,
} from '../../../assemblies/application/useCases/agendaTemplatesAdmin'
import {
  LiftAssemblyPauseUseCase,
  ListAssemblyPausesUseCase,
  PauseAssembliesUseCase,
} from '../../../assemblies/application/useCases/assemblyPauses'
import { DEFAULT_ASSEMBLY_PARAMS } from '../../../assemblies/domain/assembly'
import { DEFAULT_LIFECYCLE_PARAMS } from '../../../assemblies/domain/lifecycle'
import { DEFAULT_PROPOSAL_PARAMS } from '../../../assemblies/domain/proposals'
import {
  SHAREHOLDER_KIND,
  shareholderPolicies,
} from '../../../assemblies/domain/shareholderPolicies'
import { createFakeAgendaCatalogAdmin } from '../../../assemblies/test/fakes/fakeAgendaCatalogAdmin'
import { createFakeAssemblyPauseRepository } from '../../../assemblies/test/fakes/fakeAssemblyPauseRepository'
import { createFakeAssemblyRepository } from '../../../assemblies/test/fakes/fakeAssemblyRepository'
import { createFakeAssemblySettingsStore } from '../../../assemblies/test/fakes/fakeAssemblySettingsStore'
import { createInProcessAssemblyAdmin } from './inProcessAssemblyAdmin'
import {
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
import { RecordAdminActionUseCase } from '../../application/useCases/recordAdminAction'
import { createFakeAuditLogRepository } from '../../test/fakes/fakeAuditLogRepository'
import { createAdminAssembliesRouter } from '../../interfaces/http/adminAssembliesRouter'

const T = new Date('2026-10-11T12:00:00Z')
const DAY = 24 * 60 * 60 * 1000
const COMPANY = '0d0b8f1e-3c1a-4a52-9b0e-2f6f5f0d1a22'
const MISSING = '9d0b8f1e-3c1a-4a52-9b0e-2f6f5f0d1a99'

const effect = { metric: 'base_growth_pct', direction: 1, intensity: 0.5 }
const templateBody = {
  sector: null,
  title: 'Orçamento de capital',
  description: 'A empresa separa parte do lucro para investir.',
  options: [
    {
      key: 'expandir',
      label: 'Ampliar a capacidade',
      gain: 'Cresce mais.',
      loss: 'Margem menor.',
      effect,
    },
    {
      key: 'eficiencia',
      label: 'Ganhar eficiência',
      gain: 'Margem maior.',
      loss: 'Cresce menos.',
      effect,
    },
  ],
}

async function buildApp() {
  const tokenIssuer = createFakeTokenIssuer()
  const authMiddleware = createAuthMiddleware(tokenIssuer)
  const repository = createFakeAssemblyRepository()
  const pauses = createFakeAssemblyPauseRepository()
  const catalog = createFakeAgendaCatalogAdmin()
  const store = createFakeAssemblySettingsStore()
  const live = {
    lifecycle: { ...DEFAULT_LIFECYCLE_PARAMS },
    params: { ...DEFAULT_ASSEMBLY_PARAMS },
    proposals: { ...DEFAULT_PROPOSAL_PARAMS },
    participationXp: 10,
  }
  const settings = new AssemblySettingsService(structuredClone(live), live, store, () => T)
  const kinds = new AssemblyKindRegistry().register(SHAREHOLDER_KIND, {
    policies: shareholderPolicies,
    effect: { apply: async () => undefined },
  })
  const snapshot = {
    takenAt: T,
    holdings: [
      { userId: 'u1', quantity: 10 },
      { userId: 'u2', quantity: 30 },
    ],
  }
  const snapshots = { take: async () => snapshot, get: async () => snapshot }

  const { assembly, options } = await repository.create(
    {
      kind: SHAREHOLDER_KIND,
      subjectRef: COMPANY,
      dedupeKey: `shareholder:${COMPANY}:91`,
      opensAt: T,
      snapshotAt: T,
      closesAt: new Date(T.getTime() + 7 * DAY),
      effectAppliesAt: new Date(T.getTime() + 8 * DAY),
      title: 'Orçamento de capital',
      subjectLabel: 'Acme',
      minVoters: 3,
      options: templateBody.options.map((o) => ({ ...o })),
    },
    T,
  )
  await repository.markOpen(assembly.id)
  await repository.upsertVote({ assemblyId: assembly.id, userId: 'u1', optionId: options[0].id }, T)
  await repository.upsertVote({ assemblyId: assembly.id, userId: 'u2', optionId: options[1].id }, T)

  const assemblyAdmin = createInProcessAssemblyAdmin({
    listAssemblies: new ListAdminAssembliesUseCase(repository, pauses, () => T),
    getAssembly: new GetAdminAssemblyDetailUseCase(
      kinds,
      repository,
      snapshots,
      pauses,
      () => 3,
      () => T,
    ),
    listPauses: new ListAssemblyPausesUseCase(pauses),
    pauseAssemblies: new PauseAssembliesUseCase(pauses, () => T),
    liftPause: new LiftAssemblyPauseUseCase(pauses, () => T),
    settings,
    listTemplates: new ListTemplates(catalog),
    createTemplate: new CreateAgendaTemplateUseCase(catalog),
    updateTemplate: new UpdateAgendaTemplateUseCase(catalog),
    setTemplateActive: new SetAgendaTemplateActiveUseCase(catalog),
    readVoters: async (ids) =>
      new Map(ids.map((id) => [id, { username: `user_${id}`, name: `Pessoa ${id}` }])),
  })
  const auditLog = createFakeAuditLogRepository()
  const record = new RecordAdminActionUseCase(auditLog)
  const app = express()
  app.use(express.json())
  app.use(
    createAdminAssembliesRouter({
      listAssemblies: new ListAssembliesAdminUseCase(assemblyAdmin),
      getAssembly: new GetAssemblyAdminDetailUseCase(assemblyAdmin),
      listPauses: new ListAssemblyPausesAdminUseCase(assemblyAdmin),
      pauseAssemblies: new PauseAssembliesAdminUseCase(assemblyAdmin, record),
      liftPause: new LiftAssemblyPauseAdminUseCase(assemblyAdmin, record),
      listSettings: new ListAssemblySettingsAdminUseCase(assemblyAdmin),
      updateSetting: new UpdateAssemblySettingAdminUseCase(assemblyAdmin, record),
      resetSetting: new ResetAssemblySettingAdminUseCase(assemblyAdmin, record),
      listTemplates: new ListAgendaTemplatesAdminUseCase(assemblyAdmin),
      createTemplate: new CreateAgendaTemplateAdminUseCase(assemblyAdmin, record),
      updateTemplate: new UpdateAgendaTemplateAdminUseCase(assemblyAdmin, record),
      setTemplateActive: new SetAgendaTemplateActiveAdminUseCase(assemblyAdmin, record),
      authMiddleware,
    }),
  )
  const adminToken = () => `Bearer ${tokenIssuer.issue({ sub: 'admin-1', role: 'admin' })}`
  const userToken = () => `Bearer ${tokenIssuer.issue({ sub: 'user-1', role: 'user' })}`
  return { app, auditLog, pauses, live, store, assembly, options, adminToken, userToken }
}

const routes: Array<[string, 'get' | 'post' | 'put' | 'delete', string, object?]> = [
  ['GET /admin/assemblies', 'get', '/admin/assemblies'],
  ['GET /admin/assemblies/:id', 'get', `/admin/assemblies/${MISSING}`],
  ['GET /admin/assemblies/pauses', 'get', '/admin/assemblies/pauses'],
  [
    'POST /admin/assemblies/pauses',
    'post',
    '/admin/assemblies/pauses',
    { scope: 'global', reason: 'motivo' },
  ],
  ['POST /admin/assemblies/pauses/:id/lift', 'post', `/admin/assemblies/pauses/${MISSING}/lift`],
  ['GET /admin/assemblies/settings', 'get', '/admin/assemblies/settings'],
  [
    'PUT /admin/assemblies/settings/:key',
    'put',
    '/admin/assemblies/settings/min_voters',
    { value: 4 },
  ],
  ['DELETE /admin/assemblies/settings/:key', 'delete', '/admin/assemblies/settings/min_voters'],
  ['GET /admin/assemblies/agenda-templates', 'get', '/admin/assemblies/agenda-templates'],
  [
    'POST /admin/assemblies/agenda-templates',
    'post',
    '/admin/assemblies/agenda-templates',
    { key: 'abc', ...templateBody },
  ],
  [
    'PUT /admin/assemblies/agenda-templates/:key',
    'put',
    '/admin/assemblies/agenda-templates/abc',
    templateBody,
  ],
  [
    'POST /admin/assemblies/agenda-templates/:key/active',
    'post',
    '/admin/assemblies/agenda-templates/abc/active',
    { active: false },
  ],
]

// Fluxo ponta a ponta do painel: router, casos de uso auditados, adapter e os casos de uso reais do
// módulo `assemblies` sobre fakes de repositório. Mora aqui (e não em interfaces/) porque monta o
// adapter de infraestrutura, que o router nunca importa.
describe('painel admin das assembleias (MO.6.8)', () => {
  it.each(routes)('%s retorna 401 sem token', async (_n, method, path, body) => {
    const { app } = await buildApp()
    expect((await request(app)[method](path).send(body)).status).toBe(401)
  })

  it.each(routes)(
    '%s retorna 403 para usuário comum, sem alterar nem auditar nada',
    async (_n, method, path, body) => {
      const { app, userToken, auditLog, pauses, store } = await buildApp()
      const res = await request(app)[method](path).set('Authorization', userToken()).send(body)
      expect(res.status).toBe(403)
      expect(auditLog.entries).toHaveLength(0)
      expect(pauses.items).toHaveLength(0)
      expect(store.rows.size).toBe(0)
    },
  )

  describe('leitura', () => {
    it('lista as assembleias com a marca de efeito pendente e pausa', async () => {
      const { app, adminToken } = await buildApp()
      const res = await request(app).get('/admin/assemblies').set('Authorization', adminToken())
      expect(res.status).toBe(200)
      expect(res.body.assemblies).toHaveLength(1)
      expect(res.body.assemblies[0]).toMatchObject({
        subject_ref: COMPANY,
        subject_label: 'Acme',
        status: 'open',
        winning_option_id: null,
        min_voters: 3,
        effect_pending: false,
        paused: false,
      })
    })

    it('filtra por status e recusa status inválido', async () => {
      const { app, adminToken } = await buildApp()
      const closed = await request(app)
        .get('/admin/assemblies?status=closed')
        .set('Authorization', adminToken())
      expect(closed.body.assemblies).toEqual([])
      const bad = await request(app)
        .get('/admin/assemblies?status=foo')
        .set('Authorization', adminToken())
      expect(bad.status).toBe(400)
    })

    it('o detalhe mostra quem votou em quê, com nome e peso, e a leitura não é auditada', async () => {
      const { app, adminToken, auditLog, assembly, options } = await buildApp()
      const res = await request(app)
        .get(`/admin/assemblies/${assembly.id}`)
        .set('Authorization', adminToken())
      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ min_voters: 3, counted_voters: 2, holders: 2 })
      expect(res.body.votes).toEqual([
        expect.objectContaining({
          user_id: 'u1',
          username: 'user_u1',
          name: 'Pessoa u1',
          option_id: options[0].id,
          weight: 10,
          eligible: true,
        }),
        expect.objectContaining({
          user_id: 'u2',
          username: 'user_u2',
          option_id: options[1].id,
          weight: 30,
          eligible: true,
        }),
      ])
      expect(
        res.body.options.map((o: { key: string; voters: number; weight: number }) => [
          o.key,
          o.voters,
          o.weight,
        ]),
      ).toEqual([
        ['expandir', 1, 10],
        ['eficiencia', 1, 30],
      ])
      expect(auditLog.entries).toHaveLength(0)
    })

    it('o detalhe de assembleia inexistente é 404 e de id inválido é 400', async () => {
      const { app, adminToken } = await buildApp()
      expect(
        (await request(app).get(`/admin/assemblies/${MISSING}`).set('Authorization', adminToken()))
          .status,
      ).toBe(404)
      expect(
        (await request(app).get('/admin/assemblies/xyz').set('Authorization', adminToken())).status,
      ).toBe(400)
    })
  })

  describe('pausa', () => {
    it('pausa a global, devolve 201, aparece como vigente e audita', async () => {
      const { app, adminToken, auditLog } = await buildApp()
      const res = await request(app)
        .post('/admin/assemblies/pauses')
        .set('Authorization', adminToken())
        .send({ scope: 'global', reason: '  revisão das pautas  ' })
      expect(res.status).toBe(201)
      expect(res.body).toMatchObject({
        scope: 'global',
        company_id: null,
        reason: 'revisão das pautas',
        created_by: 'admin-1',
        lifted_at: null,
      })

      const listing = await request(app)
        .get('/admin/assemblies/pauses')
        .set('Authorization', adminToken())
      expect(listing.body.active.map((p: { id: string }) => p.id)).toEqual([res.body.id])
      expect(auditLog.entries[0]).toMatchObject({
        action: 'assembly.pause',
        targetId: res.body.id,
        result: 'success',
      })

      const rows = await request(app).get('/admin/assemblies').set('Authorization', adminToken())
      expect(rows.body.assemblies[0].paused).toBe(true)
    })

    it('pausa uma empresa e a retomada a tira das vigentes', async () => {
      const { app, adminToken, auditLog } = await buildApp()
      const created = await request(app)
        .post('/admin/assemblies/pauses')
        .set('Authorization', adminToken())
        .send({ scope: 'company', company_id: COMPANY, reason: 'balanço em revisão' })
      expect(created.status).toBe(201)
      expect(created.body).toMatchObject({ scope: 'company', company_id: COMPANY })

      const lifted = await request(app)
        .post(`/admin/assemblies/pauses/${created.body.id}/lift`)
        .set('Authorization', adminToken())
      expect(lifted.status).toBe(200)
      expect(lifted.body.lifted_by).toBe('admin-1')
      const listing = await request(app)
        .get('/admin/assemblies/pauses')
        .set('Authorization', adminToken())
      expect(listing.body.active).toEqual([])
      expect(listing.body.recent).toHaveLength(1)
      expect(auditLog.entries.map((e) => e.action)).toEqual(['assembly.pause', 'assembly.resume'])
    })

    it('segunda pausa no mesmo escopo é 409 e a recusa fica no log', async () => {
      const { app, adminToken, auditLog } = await buildApp()
      const body = { scope: 'global', reason: 'motivo' }
      await request(app)
        .post('/admin/assemblies/pauses')
        .set('Authorization', adminToken())
        .send(body)
      const again = await request(app)
        .post('/admin/assemblies/pauses')
        .set('Authorization', adminToken())
        .send(body)
      expect(again.status).toBe(409)
      expect(auditLog.entries[1]).toMatchObject({ action: 'assembly.pause', result: 'failed' })
    })

    it.each([
      ['sem motivo', { scope: 'global' }],
      ['empresa sem company_id', { scope: 'company', reason: 'motivo' }],
      ['global com company_id', { scope: 'global', company_id: COMPANY, reason: 'motivo' }],
      ['company_id que não é uuid', { scope: 'company', company_id: 'acme', reason: 'motivo' }],
      ['escopo desconhecido', { scope: 'asset', reason: 'motivo' }],
    ])('recusa pedido inválido (%s) com 400, sem gravar', async (_n, body) => {
      const { app, adminToken, pauses } = await buildApp()
      const res = await request(app)
        .post('/admin/assemblies/pauses')
        .set('Authorization', adminToken())
        .send(body)
      expect(res.status).toBe(400)
      expect(pauses.items).toHaveLength(0)
    })

    it('motivo curto demais é 422 do domínio', async () => {
      const { app, adminToken } = await buildApp()
      const res = await request(app)
        .post('/admin/assemblies/pauses')
        .set('Authorization', adminToken())
        .send({ scope: 'global', reason: 'x' })
      expect(res.status).toBe(422)
    })

    it('retomar inexistente é 404 e retomar de novo é 409', async () => {
      const { app, adminToken } = await buildApp()
      expect(
        (
          await request(app)
            .post(`/admin/assemblies/pauses/${MISSING}/lift`)
            .set('Authorization', adminToken())
        ).status,
      ).toBe(404)
      const created = await request(app)
        .post('/admin/assemblies/pauses')
        .set('Authorization', adminToken())
        .send({ scope: 'global', reason: 'motivo' })
      await request(app)
        .post(`/admin/assemblies/pauses/${created.body.id}/lift`)
        .set('Authorization', adminToken())
      expect(
        (
          await request(app)
            .post(`/admin/assemblies/pauses/${created.body.id}/lift`)
            .set('Authorization', adminToken())
        ).status,
      ).toBe(409)
    })
  })

  describe('parâmetros', () => {
    it('lista os 9 com padrão, faixa e se foi alterado', async () => {
      const { app, adminToken } = await buildApp()
      const res = await request(app)
        .get('/admin/assemblies/settings')
        .set('Authorization', adminToken())
      expect(res.status).toBe(200)
      expect(res.body.settings).toHaveLength(9)
      expect(res.body.settings.find((s: { key: string }) => s.key === 'min_voters')).toMatchObject({
        value: 3,
        default: 3,
        min: 1,
        max: 1000,
        overridden: false,
      })
    })

    it('altera um parâmetro: vale na hora para o módulo, fica gravado e audita', async () => {
      const { app, adminToken, auditLog, live } = await buildApp()
      const res = await request(app)
        .put('/admin/assemblies/settings/min_voters')
        .set('Authorization', adminToken())
        .send({ value: 5 })
      expect(res.status).toBe(200)
      expect(res.body.settings.find((s: { key: string }) => s.key === 'min_voters')).toMatchObject({
        value: 5,
        overridden: true,
        updated_by: 'admin-1',
      })
      expect(live.params.minVoters).toBe(5)
      expect(auditLog.entries[0]).toMatchObject({
        action: 'assembly.setting_update',
        targetId: 'min_voters',
        payload: { key: 'min_voters', value: 5 },
      })
    })

    it('restaura o padrão', async () => {
      const { app, adminToken, live } = await buildApp()
      await request(app)
        .put('/admin/assemblies/settings/min_voters')
        .set('Authorization', adminToken())
        .send({ value: 5 })
      const res = await request(app)
        .delete('/admin/assemblies/settings/min_voters')
        .set('Authorization', adminToken())
      expect(res.status).toBe(200)
      expect(live.params.minVoters).toBe(3)
      expect(
        res.body.settings.find((s: { key: string }) => s.key === 'min_voters').overridden,
      ).toBe(false)
    })

    it('valor fora da faixa é 422, não grava e a recusa é auditada', async () => {
      const { app, adminToken, auditLog, store } = await buildApp()
      const res = await request(app)
        .put('/admin/assemblies/settings/min_voters')
        .set('Authorization', adminToken())
        .send({ value: 0 })
      expect(res.status).toBe(422)
      expect(res.body.error).toMatch(/1 a 1000/)
      expect(store.rows.size).toBe(0)
      expect(auditLog.entries[0]).toMatchObject({
        action: 'assembly.setting_update',
        result: 'failed',
      })
    })

    it('chave desconhecida é 404 e value que não é inteiro é 400', async () => {
      const { app, adminToken } = await buildApp()
      expect(
        (
          await request(app)
            .put('/admin/assemblies/settings/governance_ramp_ticks')
            .set('Authorization', adminToken())
            .send({ value: 3 })
        ).status,
      ).toBe(404)
      expect(
        (
          await request(app)
            .delete('/admin/assemblies/settings/xyz')
            .set('Authorization', adminToken())
        ).status,
      ).toBe(404)
      expect(
        (
          await request(app)
            .put('/admin/assemblies/settings/min_voters')
            .set('Authorization', adminToken())
            .send({ value: 'abc' })
        ).status,
      ).toBe(400)
    })

    it('mudar o quórum não muda o da assembleia já aberta (fica o da abertura)', async () => {
      const { app, adminToken, assembly } = await buildApp()
      await request(app)
        .put('/admin/assemblies/settings/min_voters')
        .set('Authorization', adminToken())
        .send({ value: 9 })
      const res = await request(app)
        .get(`/admin/assemblies/${assembly.id}`)
        .set('Authorization', adminToken())
      expect(res.body.min_voters).toBe(3)
    })
  })

  describe('catálogo de pautas', () => {
    it('cria (201), lista, edita, desativa e audita cada passo', async () => {
      const { app, adminToken, auditLog } = await buildApp()
      const created = await request(app)
        .post('/admin/assemblies/agenda-templates')
        .set('Authorization', adminToken())
        .send({ key: 'capital_budget', ...templateBody })
      expect(created.status).toBe(201)
      expect(created.body).toMatchObject({
        key: 'capital_budget',
        active: true,
        usage: { assemblies: 0, active_proposals: 0 },
      })

      const edited = await request(app)
        .put('/admin/assemblies/agenda-templates/capital_budget')
        .set('Authorization', adminToken())
        .send({ ...templateBody, title: 'Novo título' })
      expect(edited.status).toBe(200)
      expect(edited.body.title).toBe('Novo título')

      const off = await request(app)
        .post('/admin/assemblies/agenda-templates/capital_budget/active')
        .set('Authorization', adminToken())
        .send({ active: false })
      expect(off.body.active).toBe(false)

      const list = await request(app)
        .get('/admin/assemblies/agenda-templates')
        .set('Authorization', adminToken())
      expect(list.body.templates).toHaveLength(1)
      expect(auditLog.entries.map((e) => e.action)).toEqual([
        'assembly.template_create',
        'assembly.template_update',
        'assembly.template_deactivate',
      ])
    })

    it('chave repetida é 409; pauta inexistente é 404; efeito fora da faixa é 422', async () => {
      const { app, adminToken } = await buildApp()
      const post = (body: object) =>
        request(app)
          .post('/admin/assemblies/agenda-templates')
          .set('Authorization', adminToken())
          .send(body)
      await post({ key: 'capital_budget', ...templateBody })
      expect((await post({ key: 'capital_budget', ...templateBody })).status).toBe(409)
      expect(
        (
          await request(app)
            .put('/admin/assemblies/agenda-templates/nao_existe')
            .set('Authorization', adminToken())
            .send(templateBody)
        ).status,
      ).toBe(404)
      expect(
        (
          await request(app)
            .post('/admin/assemblies/agenda-templates/nao_existe/active')
            .set('Authorization', adminToken())
            .send({ active: true })
        ).status,
      ).toBe(404)
      const bad = await post({
        key: 'outra_pauta',
        ...templateBody,
        options: [
          templateBody.options[0],
          { ...templateBody.options[1], effect: { ...effect, intensity: 5 } },
        ],
      })
      expect(bad.status).toBe(422)
      expect(bad.body.error).toMatch(/intensidade/)
    })

    it('corpo malformado é 400', async () => {
      const { app, adminToken } = await buildApp()
      expect(
        (
          await request(app)
            .post('/admin/assemblies/agenda-templates')
            .set('Authorization', adminToken())
            .send({ key: 'abc' })
        ).status,
      ).toBe(400)
      expect(
        (
          await request(app)
            .post('/admin/assemblies/agenda-templates/abc/active')
            .set('Authorization', adminToken())
            .send({ active: 'sim' })
        ).status,
      ).toBe(400)
    })
  })
})
