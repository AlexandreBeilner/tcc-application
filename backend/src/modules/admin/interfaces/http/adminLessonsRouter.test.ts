import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { UserSessionGuard } from '../../../auth/application/services/userSessionGuard'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import { createFakeUserRepository } from '../../../auth/test/fakes/fakeUserRepository'
import { emptyFunnel } from '../../../lessons/test/fakes/fakeLessonCatalogRepository'
import { buildCatalogLesson, LESSON_IDS } from '../../../lessons/test/fakes/lessonFixtures'
import {
  CreateLessonAdminUseCase,
  GetLessonForEditAdminUseCase,
  GetLessonRevisionAdminUseCase,
  ListLessonCatalogAdminUseCase,
  RestoreLessonRevisionAdminUseCase,
  SetLessonPublishedAdminUseCase,
  UpdateLessonContentAdminUseCase,
} from '../../application/useCases/lessonCatalog'
import { RecordAdminActionUseCase } from '../../application/useCases/recordAdminAction'
import { createFakeAuditLogRepository } from '../../test/fakes/fakeAuditLogRepository'
import { createInMemoryLessonCatalogAdmin } from '../../test/fakes/inMemoryLessonCatalogAdmin'
import { createAdminLessonsRouter } from './adminLessonsRouter'

async function buildApp() {
  const userRepository = createFakeUserRepository()
  const tokenIssuer = createFakeTokenIssuer()
  const auditLog = createFakeAuditLogRepository()
  const record = new RecordAdminActionUseCase(auditLog)
  const { lessonCatalogAdmin, catalogRepository } = createInMemoryLessonCatalogAdmin({
    lessons: [
      buildCatalogLesson({ id: LESSON_IDS.a, code: '0.1', sortOrder: 1 }),
      buildCatalogLesson({
        id: LESSON_IDS.b,
        code: '0.2',
        sortOrder: 2,
        microDecisionOptions: ['x', 'y'],
        microDecisionCorrectOption: 1,
      }),
    ],
    assets: { VALR3: 'acao', LFT2029: 'tesouro_selic' },
    funnels: {
      [LESSON_IDS.a]: emptyFunnel({ started: 10, completed: 5, abandonedByStep: [1, 2, 2, 0] }),
    },
  })
  const admin = await userRepository.createUser({
    name: 'Admin',
    email: 'admin@example.com',
    username: 'admin',
    passwordHash: 'x',
    role: 'admin',
  })
  const user = await userRepository.createUser({
    name: 'Fulano',
    email: 'fulano@example.com',
    username: 'fulano',
    passwordHash: 'x',
  })
  const app = express()
  app.use(express.json())
  app.use(
    createAdminLessonsRouter({
      listLessonCatalog: new ListLessonCatalogAdminUseCase(lessonCatalogAdmin),
      setLessonPublished: new SetLessonPublishedAdminUseCase(lessonCatalogAdmin, record),
      getLessonForEdit: new GetLessonForEditAdminUseCase(lessonCatalogAdmin),
      updateLessonContent: new UpdateLessonContentAdminUseCase(lessonCatalogAdmin, record),
      createLesson: new CreateLessonAdminUseCase(lessonCatalogAdmin, record),
      getLessonRevision: new GetLessonRevisionAdminUseCase(lessonCatalogAdmin),
      restoreLessonRevision: new RestoreLessonRevisionAdminUseCase(lessonCatalogAdmin, record),
      authMiddleware: createAuthMiddleware(tokenIssuer, new UserSessionGuard(userRepository)),
    }),
  )
  return {
    app,
    auditLog,
    catalogRepository,
    auth: (token: string) => ({ Authorization: `Bearer ${token}` }),
    adminId: admin.id,
    adminToken: tokenIssuer.issue({ sub: admin.id, role: 'admin' }),
    userToken: tokenIssuer.issue({ sub: user.id, role: 'user' }),
  }
}

describe('permissões', () => {
  it.each([
    ['get', '/admin/lessons'],
    ['patch', `/admin/lessons/${LESSON_IDS.a}/published`],
    ['get', `/admin/lessons/${LESSON_IDS.a}`],
    ['put', `/admin/lessons/${LESSON_IDS.a}`],
    ['post', '/admin/lessons'],
    ['get', `/admin/lessons/${LESSON_IDS.a}/revisions/${LESSON_IDS.b}`],
    ['post', `/admin/lessons/${LESSON_IDS.a}/revisions/${LESSON_IDS.b}/restore`],
  ] as const)('%s %s exige token e papel admin', async (method, url) => {
    const { app, userToken, auth } = await buildApp()

    expect((await request(app)[method](url)).status).toBe(401)
    expect((await request(app)[method](url).set(auth(userToken))).status).toBe(403)
  })
})

describe('GET /admin/lessons', () => {
  it('lista a trilha com pré-requisito, tipo e funil', async () => {
    const { app, adminToken, auth } = await buildApp()

    const res = await request(app).get('/admin/lessons').set(auth(adminToken))

    expect(res.status).toBe(200)
    expect(res.body.lessons).toHaveLength(2)
    expect(res.body.lessons[0]).toMatchObject({
      id: LESSON_IDS.a,
      code: '0.1',
      track_number: 0,
      micro_decision_type: 'reflection',
      has_bet: false,
      published: true,
      prerequisite_code: null,
      funnel: {
        started: 10,
        completed: 5,
        completion_rate: 0.5,
        abandoned: 5,
        abandoned_by_step: [1, 2, 2, 0],
      },
    })
    expect(res.body.lessons[1]).toMatchObject({
      code: '0.2',
      has_bet: true,
      prerequisite_code: '0.1',
    })
    expect(res.body.lessons[1].funnel.completion_rate).toBeNull()
  })
})

describe('PATCH /admin/lessons/:id/published', () => {
  it('despublica, audita com o código e devolve a lição', async () => {
    const { app, adminToken, auth, auditLog, adminId } = await buildApp()

    const res = await request(app)
      .patch(`/admin/lessons/${LESSON_IDS.b}/published`)
      .set(auth(adminToken))
      .send({ published: false })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      id: LESSON_IDS.b,
      code: '0.2',
      published: false,
      waived_users: 0,
    })
    expect(auditLog.entries[0]).toMatchObject({
      adminId,
      action: 'lesson.unpublish',
      targetType: 'lesson',
      targetId: LESSON_IDS.b,
      result: 'success',
      payload: { code: '0.2', waived_users: 0 },
    })
  })

  it('publicar de volta devolve quantos usuários receberam dispensa e audita lesson.publish', async () => {
    const { app, adminToken, auth, auditLog, catalogRepository } = await buildApp()
    await request(app)
      .patch(`/admin/lessons/${LESSON_IDS.b}/published`)
      .set(auth(adminToken))
      .send({ published: false })
    catalogRepository.waivedUsers = 3

    const res = await request(app)
      .patch(`/admin/lessons/${LESSON_IDS.b}/published`)
      .set(auth(adminToken))
      .send({ published: true })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ published: true, waived_users: 3 })
    expect(auditLog.entries[1]).toMatchObject({
      action: 'lesson.publish',
      payload: { code: '0.2', waived_users: 3 },
    })
  })

  it('repetir o estado atual é 409 e fica auditado como falha', async () => {
    const { app, adminToken, auth, auditLog } = await buildApp()

    const res = await request(app)
      .patch(`/admin/lessons/${LESSON_IDS.a}/published`)
      .set(auth(adminToken))
      .send({ published: true })

    expect(res.status).toBe(409)
    expect(auditLog.entries[0]).toMatchObject({ action: 'lesson.publish', result: 'failed' })
  })

  it('lição inexistente é 404, corpo inválido é 400, id que não é uuid é 400', async () => {
    const { app, adminToken, auth } = await buildApp()

    expect(
      (
        await request(app)
          .patch(`/admin/lessons/${LESSON_IDS.unknown}/published`)
          .set(auth(adminToken))
          .send({ published: false })
      ).status,
    ).toBe(404)
    expect(
      (
        await request(app)
          .patch(`/admin/lessons/${LESSON_IDS.a}/published`)
          .set(auth(adminToken))
          .send({ published: 'sim' })
      ).status,
    ).toBe(400)
    expect(
      (
        await request(app)
          .patch('/admin/lessons/nao-uuid/published')
          .set(auth(adminToken))
          .send({ published: false })
      ).status,
    ).toBe(400)
  })
})

// Conteúdo da lição 0.1 do cenário de teste, no formato da API (snake_case).
const bodyOf = (overrides: Record<string, unknown> = {}) => ({
  title: 'O que é investir',
  central_concept: 'Investir é abrir mão de consumo hoje',
  scenario_text: 'Cenário',
  micro_decision_prompt: 'Pense',
  micro_decision_type: 'reflection',
  micro_decision_asset_ticker: null,
  micro_decision_options: null,
  micro_decision_correct_option: null,
  revelation_text: 'Revelação',
  unlocks_description: null,
  unlocks_keys: [],
  unlocks_asset_ticker: null,
  ...overrides,
})

describe('GET /admin/lessons/:id', () => {
  it('devolve o conteúdo completo (inclusive a resposta certa, que o painel precisa) e o histórico', async () => {
    const { app, adminToken, auth } = await buildApp()

    const res = await request(app).get(`/admin/lessons/${LESSON_IDS.b}`).set(auth(adminToken))

    expect(res.status).toBe(200)
    expect(res.body.lesson).toMatchObject({
      id: LESSON_IDS.b,
      code: '0.2',
      track_number: 0,
      published: true,
      micro_decision_options: ['x', 'y'],
      micro_decision_correct_option: 1,
    })
    expect(res.body.revisions).toEqual([])
  })

  it('404 pra lição inexistente, 400 pra id que não é uuid', async () => {
    const { app, adminToken, auth } = await buildApp()

    expect(
      (await request(app).get(`/admin/lessons/${LESSON_IDS.unknown}`).set(auth(adminToken))).status,
    ).toBe(404)
    expect((await request(app).get('/admin/lessons/nao-uuid').set(auth(adminToken))).status).toBe(
      400,
    )
  })
})

describe('PUT /admin/lessons/:id', () => {
  it('grava o conteúdo, devolve avisos de copy e audita só os nomes dos campos que mudaram', async () => {
    const { app, adminToken, auth, auditLog } = await buildApp()

    const res = await request(app)
      .put(`/admin/lessons/${LESSON_IDS.a}`)
      .set(auth(adminToken))
      .send(bodyOf({ title: 'Novo título', scenario_text: 'Antes — depois' }))

    expect(res.status).toBe(200)
    expect(res.body.lesson).toMatchObject({
      id: LESSON_IDS.a,
      title: 'Novo título',
      scenario_text: 'Antes — depois',
    })
    expect(res.body.warnings).toEqual([
      'o campo cenário usa travessão (—) como pontuação; o texto do produto evita',
    ])
    expect(auditLog.entries[0]).toMatchObject({
      action: 'lesson.update',
      targetType: 'lesson',
      targetId: LESSON_IDS.a,
      result: 'success',
      payload: { code: '0.1', changed_fields: ['title', 'scenario_text'] },
    })
    // O texto da lição nunca vai pro log.
    expect(JSON.stringify(auditLog.entries[0].payload)).not.toContain('Novo título')
    const after = await request(app).get(`/admin/lessons/${LESSON_IDS.a}`).set(auth(adminToken))
    expect(after.body.revisions.map((r: { action: string }) => r.action)).toEqual([
      'update',
      'baseline',
    ])
  })

  it('conteúdo recusado pelo domínio é 422 com a mensagem, auditado como falha e não grava', async () => {
    const { app, adminToken, auth, auditLog, catalogRepository } = await buildApp()

    const res = await request(app)
      .put(`/admin/lessons/${LESSON_IDS.a}`)
      .set(auth(adminToken))
      .send(
        bodyOf({
          micro_decision_options: ['só uma'],
          micro_decision_correct_option: 0,
          unlocks_keys: ['asset:acao'],
        }),
      )

    expect(res.status).toBe(422)
    expect(res.body.code).toBe('invalid_lesson')
    expect(res.body.error).toContain('a aposta tem de 2 a 6 opções')
    expect(res.body.error).toContain(
      'chave de produto (asset:*) exige o ticker do produto desbloqueado',
    )
    expect(auditLog.entries[0]).toMatchObject({ action: 'lesson.update', result: 'failed' })
    expect(catalogRepository.revisions).toEqual([])
  })

  it('ticker que não existe no catálogo do motor é 422', async () => {
    const { app, adminToken, auth } = await buildApp()

    const res = await request(app)
      .put(`/admin/lessons/${LESSON_IDS.a}`)
      .set(auth(adminToken))
      .send(bodyOf({ micro_decision_type: 'live_indicator', micro_decision_asset_ticker: 'NADA3' }))

    expect(res.status).toBe(422)
    expect(res.body.error).toBe('o ticker NADA3 não existe no catálogo')
  })

  it('sem nenhuma mudança é 409; 404 pra lição inexistente; 400 pra corpo de tipo errado', async () => {
    const { app, adminToken, auth } = await buildApp()
    const put = (id: string, body: unknown) =>
      request(app)
        .put(`/admin/lessons/${id}`)
        .set(auth(adminToken))
        .send(body as object)

    expect((await put(LESSON_IDS.a, bodyOf())).status).toBe(409)
    expect((await put(LESSON_IDS.unknown, bodyOf({ title: 'x' }))).status).toBe(404)
    expect((await put(LESSON_IDS.a, bodyOf({ unlocks_keys: 'portfolio' }))).status).toBe(400)
    expect((await put(LESSON_IDS.a, { title: 'só isso' })).status).toBe(400)
  })
})

describe('POST /admin/lessons', () => {
  it('cria depois da lição de referência, na trilha dela, devolve 201 com os dispensados e audita com o código', async () => {
    const { app, adminToken, auth, auditLog, catalogRepository } = await buildApp()
    catalogRepository.waivedUsers = 5

    const res = await request(app)
      .post('/admin/lessons')
      .set(auth(adminToken))
      .send({ ...bodyOf({ title: 'Lição nova' }), after_lesson_id: LESSON_IDS.a })

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ waived_users: 5, warnings: [] })
    expect(res.body.lesson).toMatchObject({
      title: 'Lição nova',
      track_number: 0,
      sort_order: 2,
      published: true,
    })
    expect(auditLog.entries[0]).toMatchObject({
      action: 'lesson.create',
      targetType: 'lesson',
      targetId: res.body.lesson.id,
      result: 'success',
      payload: { after_lesson_id: LESSON_IDS.a, title: 'Lição nova', waived_users: 5 },
    })
  })

  it('referência inexistente é 404, conteúdo inválido é 422 e sem after_lesson_id é 400', async () => {
    const { app, adminToken, auth } = await buildApp()
    const post = (body: unknown) =>
      request(app)
        .post('/admin/lessons')
        .set(auth(adminToken))
        .send(body as object)

    expect((await post({ ...bodyOf(), after_lesson_id: LESSON_IDS.unknown })).status).toBe(404)
    expect((await post({ ...bodyOf({ title: '' }), after_lesson_id: LESSON_IDS.a })).status).toBe(
      422,
    )
    expect((await post(bodyOf())).status).toBe(400)
    expect((await post({ ...bodyOf(), after_lesson_id: null })).status).toBe(201)
  })
})

describe('revisões', () => {
  it('lista, lê o retrato e restaura gerando uma revisão restore auditada', async () => {
    const { app, adminToken, auth, auditLog } = await buildApp()
    await request(app)
      .put(`/admin/lessons/${LESSON_IDS.a}`)
      .set(auth(adminToken))
      .send(bodyOf({ title: 'v2' }))
    const detail = await request(app).get(`/admin/lessons/${LESSON_IDS.a}`).set(auth(adminToken))
    const baseline = detail.body.revisions.find((r: { action: string }) => r.action === 'baseline')

    const snapshot = await request(app)
      .get(`/admin/lessons/${LESSON_IDS.a}/revisions/${baseline.id}`)
      .set(auth(adminToken))
    expect(snapshot.status).toBe(200)
    expect(snapshot.body).toMatchObject({
      id: baseline.id,
      action: 'baseline',
      admin_id: null,
      title: 'O que é investir',
    })

    const restored = await request(app)
      .post(`/admin/lessons/${LESSON_IDS.a}/revisions/${baseline.id}/restore`)
      .set(auth(adminToken))
    expect(restored.status).toBe(200)
    expect(restored.body.lesson.title).toBe('O que é investir')
    expect(auditLog.entries[1]).toMatchObject({
      action: 'lesson.restore',
      result: 'success',
      payload: { revision_id: baseline.id, code: '0.1', changed_fields: ['title'] },
    })
    const after = await request(app).get(`/admin/lessons/${LESSON_IDS.a}`).set(auth(adminToken))
    expect(after.body.revisions.map((r: { action: string }) => r.action)).toEqual([
      'restore',
      'update',
      'baseline',
    ])
  })

  it('revisão inexistente ou de outra lição é 404; restaurar o que já está igual é 409', async () => {
    const { app, adminToken, auth } = await buildApp()
    await request(app)
      .put(`/admin/lessons/${LESSON_IDS.a}`)
      .set(auth(adminToken))
      .send(bodyOf({ title: 'v2' }))
    const detail = await request(app).get(`/admin/lessons/${LESSON_IDS.a}`).set(auth(adminToken))
    const latest = detail.body.revisions[0]

    expect(
      (
        await request(app)
          .get(`/admin/lessons/${LESSON_IDS.a}/revisions/${LESSON_IDS.unknown}`)
          .set(auth(adminToken))
      ).status,
    ).toBe(404)
    expect(
      (
        await request(app)
          .get(`/admin/lessons/${LESSON_IDS.b}/revisions/${latest.id}`)
          .set(auth(adminToken))
      ).status,
    ).toBe(404)
    expect(
      (
        await request(app)
          .post(`/admin/lessons/${LESSON_IDS.a}/revisions/${latest.id}/restore`)
          .set(auth(adminToken))
      ).status,
    ).toBe(409)
  })
})
