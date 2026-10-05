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
  ListLessonCatalogAdminUseCase,
  SetLessonPublishedAdminUseCase,
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
    catalogRepository.waivedOnPublish = 3

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
