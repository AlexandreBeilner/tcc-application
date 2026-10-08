import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { UserSessionGuard } from '../../../auth/application/services/userSessionGuard'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import { createFakeUserRepository } from '../../../auth/test/fakes/fakeUserRepository'
import { CreditUserCashUseCase } from '../../application/useCases/creditUserCash'
import { RecordAdminActionUseCase } from '../../application/useCases/recordAdminAction'
import {
  AdjustUserXpUseCase,
  CompleteUserLessonUseCase,
  GetUserCorrectionContextUseCase,
  GrantUserAchievementUseCase,
  ReopenUserLessonUseCase,
  SetUserStreakUseCase,
} from '../../application/useCases/userCorrections'
import {
  AdminCorrectionConflictError,
  AdminCorrectionNotFoundError,
  CashCreditOverflowError,
  CashCreditRejectedError,
  InvalidAdminCorrectionError,
} from '../../domain/errors'
import { createFakeAuditLogRepository } from '../../test/fakes/fakeAuditLogRepository'
import { createFakeUserCashCreditor } from '../../test/fakes/fakeUserCashCreditor'
import { createFakeUserCorrections } from '../../test/fakes/fakeUserCorrections'
import { createAdminUserCorrectionsRouter } from './adminUserCorrectionsRouter'

const ACHIEVEMENT_ID = '6f9619ff-8b86-d011-b42d-00c04fc964aa'
const LESSON_ID = '6f9619ff-8b86-d011-b42d-00c04fc964bb'
const UNKNOWN_USER_ID = '6f9619ff-8b86-d011-b42d-00c04fc964ff'

async function buildApp() {
  const userRepository = createFakeUserRepository()
  const tokenIssuer = createFakeTokenIssuer()
  const auditLog = createFakeAuditLogRepository()
  const record = new RecordAdminActionUseCase(auditLog)
  const corrections = createFakeUserCorrections()
  const cashCreditor = createFakeUserCashCreditor()
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
  const authMiddleware = createAuthMiddleware(tokenIssuer, new UserSessionGuard(userRepository))
  const app = express()
  app.use(express.json())
  app.use(
    createAdminUserCorrectionsRouter({
      creditUserCash: new CreditUserCashUseCase(userRepository, cashCreditor, record),
      adjustUserXp: new AdjustUserXpUseCase(userRepository, corrections, record),
      setUserStreak: new SetUserStreakUseCase(userRepository, corrections, record),
      grantUserAchievement: new GrantUserAchievementUseCase(userRepository, corrections, record),
      completeUserLesson: new CompleteUserLessonUseCase(userRepository, corrections, record),
      reopenUserLesson: new ReopenUserLessonUseCase(userRepository, corrections, record),
      getCorrectionContext: new GetUserCorrectionContextUseCase(userRepository, corrections),
      authMiddleware,
    }),
  )
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` })
  return {
    app,
    user,
    auditLog,
    corrections,
    cashCreditor,
    auth,
    adminToken: tokenIssuer.issue({ sub: admin.id, role: 'admin' }),
    staleAdminToken: tokenIssuer.issue({ sub: admin.id, role: 'admin', authTime: 1000 }),
    userToken: tokenIssuer.issue({ sub: user.id, role: 'user' }),
  }
}

describe('POST /admin/users/:id/credit', () => {
  it('credita, devolve o valor creditado e audita valor, usuário e motivo', async () => {
    const { app, adminToken, user, auth, cashCreditor, auditLog } = await buildApp()

    const res = await request(app)
      .post(`/admin/users/${user.id}/credit`)
      .set(auth(adminToken))
      .send({ amount: 1500.456, reason: 'reparo do bug' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ user_id: user.id, credited: 1500.46 })
    expect(cashCreditor.calls).toEqual([{ userId: user.id, amount: 1500.456 }])
    expect(auditLog.entries[0]).toMatchObject({
      action: 'user.credit',
      targetId: user.id,
      payload: { amount: 1500.456, reason: 'reparo do bug', credited: 1500.46 },
    })
  })

  it('o motivo é opcional', async () => {
    const { app, adminToken, user, auth } = await buildApp()
    const res = await request(app)
      .post(`/admin/users/${user.id}/credit`)
      .set(auth(adminToken))
      .send({ amount: 100 })
    expect(res.status).toBe(200)
  })

  it.each([
    ['zero', { amount: 0 }],
    ['negativo', { amount: -5 }],
    ['texto', { amount: 'dez' }],
    ['ausente', {}],
    ['motivo longo demais', { amount: 10, reason: 'x'.repeat(501) }],
  ])('recusa valor inválido (%s) com 400, sem chamar o motor', async (_name, body) => {
    const { app, adminToken, user, auth, cashCreditor } = await buildApp()

    const res = await request(app)
      .post(`/admin/users/${user.id}/credit`)
      .set(auth(adminToken))
      .send(body)

    expect(res.status).toBe(400)
    expect(cashCreditor.calls).toEqual([])
  })

  it('NaN e infinito não existem em JSON: viram valor ausente e são recusados', async () => {
    const { app, adminToken, user, auth } = await buildApp()
    for (const raw of ['{"amount":NaN}', '{"amount":Infinity}', '{"amount":1e999}']) {
      const res = await request(app)
        .post(`/admin/users/${user.id}/credit`)
        .set(auth(adminToken))
        .set('Content-Type', 'application/json')
        .send(raw)
      expect(res.status).toBeGreaterThanOrEqual(400)
      expect(res.status).toBeLessThan(500)
    }
  })

  it('exige papel admin e senha recente', async () => {
    const { app, user, userToken, staleAdminToken, auth } = await buildApp()
    const url = `/admin/users/${user.id}/credit`

    expect((await request(app).post(url).send({ amount: 10 })).status).toBe(401)
    expect((await request(app).post(url).set(auth(userToken)).send({ amount: 10 })).status).toBe(
      403,
    )
    const stale = await request(app).post(url).set(auth(staleAdminToken)).send({ amount: 10 })
    expect(stale.status).toBe(401)
    expect(stale.body).toEqual({ error: 'reauth_required' })
  })

  it('devolve 404 pra usuário inexistente, 400 pra id que não é uuid, 422 quando o motor recusa', async () => {
    const { app, adminToken, user, auth, cashCreditor } = await buildApp()

    expect(
      (
        await request(app)
          .post(`/admin/users/${UNKNOWN_USER_ID}/credit`)
          .set(auth(adminToken))
          .send({ amount: 10 })
      ).status,
    ).toBe(404)
    expect(
      (
        await request(app)
          .post('/admin/users/abc/credit')
          .set(auth(adminToken))
          .send({ amount: 10 })
      ).status,
    ).toBe(400)

    cashCreditor.failWith = new CashCreditRejectedError('passa do máximo')
    const rejected = await request(app)
      .post(`/admin/users/${user.id}/credit`)
      .set(auth(adminToken))
      .send({ amount: 2e12 })
    expect(rejected.status).toBe(422)
    expect(rejected.body.code).toBe('credit_rejected')

    cashCreditor.failWith = new CashCreditOverflowError('estoura o saldo')
    const overflow = await request(app)
      .post(`/admin/users/${user.id}/credit`)
      .set(auth(adminToken))
      .send({ amount: 10 })
    expect(overflow.status).toBe(422)
    expect(overflow.body.code).toBe('balance_overflow')
  })
})

describe('POST /admin/users/:id/xp e /streak', () => {
  it('ajusta XP e devolve a progressão em snake_case', async () => {
    const { app, adminToken, user, auth, corrections } = await buildApp()

    const res = await request(app)
      .post(`/admin/users/${user.id}/xp`)
      .set(auth(adminToken))
      .send({ delta: -50, reason: 'XP dado por engano' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ xp: 100, level: 2, current_streak: 0, longest_streak: 0 })
    expect(corrections.calls[0]).toEqual({ method: 'adjustXp', args: [user.id, -50] })
  })

  it('define o streak', async () => {
    const { app, adminToken, user, auth, corrections } = await buildApp()

    const res = await request(app)
      .post(`/admin/users/${user.id}/streak`)
      .set(auth(adminToken))
      .send({ value: 7, reason: 'streak perdido por falha nossa' })

    expect(res.status).toBe(200)
    expect(corrections.calls[0]).toEqual({ method: 'setStreak', args: [user.id, 7] })
  })

  it.each([
    ['xp sem motivo', 'xp', { delta: 10 }],
    ['xp com motivo curto', 'xp', { delta: 10, reason: 'ok' }],
    ['xp zero', 'xp', { delta: 0, reason: 'motivo válido' }],
    ['xp fracionado', 'xp', { delta: 1.5, reason: 'motivo válido' }],
    ['streak sem motivo', 'streak', { value: 3 }],
    ['streak negativo', 'streak', { value: -1, reason: 'motivo válido' }],
    ['streak fracionado', 'streak', { value: 2.5, reason: 'motivo válido' }],
  ])('recusa ajuste inválido (%s) com 400', async (_name, path, body) => {
    const { app, adminToken, user, auth, corrections } = await buildApp()

    const res = await request(app)
      .post(`/admin/users/${user.id}/${path}`)
      .set(auth(adminToken))
      .send(body)

    expect(res.status).toBe(400)
    expect(corrections.calls).toEqual([])
  })

  it('traduz a recusa de regra (XP abaixo de zero) pra 422', async () => {
    const { app, adminToken, user, auth, corrections } = await buildApp()
    corrections.failWith = new InvalidAdminCorrectionError('não dá pra tirar 999')

    const res = await request(app)
      .post(`/admin/users/${user.id}/xp`)
      .set(auth(adminToken))
      .send({ delta: -999, reason: 'tirar tudo' })

    expect(res.status).toBe(422)
    expect(res.body.code).toBe('invalid_correction')
  })
})

describe('conquistas e lições', () => {
  const cases = [
    ['achievements', ACHIEVEMENT_ID, 'grant', 'grantAchievement'],
    ['lessons', LESSON_ID, 'complete', 'completeLesson'],
    ['lessons', LESSON_ID, 'reopen', 'reopenLesson'],
  ] as const

  it.each(cases)('POST /%s/:id/%s responde 204 e chama a porta', async (kind, id, verb, method) => {
    const { app, adminToken, user, auth, corrections } = await buildApp()

    const res = await request(app)
      .post(`/admin/users/${user.id}/${kind}/${id}/${verb}`)
      .set(auth(adminToken))
      .send({ reason: 'correção de suporte' })

    expect(res.status).toBe(204)
    expect(corrections.calls[0]).toEqual({ method, args: [user.id, id] })
  })

  it.each(cases)('POST /%s/:id/%s recusa sem motivo (400)', async (kind, id, verb) => {
    const { app, adminToken, user, auth, corrections } = await buildApp()

    const res = await request(app)
      .post(`/admin/users/${user.id}/${kind}/${id}/${verb}`)
      .set(auth(adminToken))
      .send({})

    expect(res.status).toBe(400)
    expect(corrections.calls).toEqual([])
  })

  it('traduz 404 (conquista ou lição inexistente) e 409 (nada a mudar)', async () => {
    const { app, adminToken, user, auth, corrections } = await buildApp()
    const url = `/admin/users/${user.id}/achievements/${ACHIEVEMENT_ID}/grant`

    corrections.failWith = new AdminCorrectionNotFoundError('conquista não encontrada')
    expect(
      (await request(app).post(url).set(auth(adminToken)).send({ reason: 'motivo válido' })).status,
    ).toBe(404)

    corrections.failWith = new AdminCorrectionConflictError('o usuário já tem essa conquista')
    expect(
      (await request(app).post(url).set(auth(adminToken)).send({ reason: 'motivo válido' })).status,
    ).toBe(409)
  })

  it('não oferece revogar conquista (N.26): a rota não existe', async () => {
    const { app, adminToken, user, auth, corrections } = await buildApp()

    const res = await request(app)
      .post(`/admin/users/${user.id}/achievements/${ACHIEVEMENT_ID}/revoke`)
      .set(auth(adminToken))
      .send({ reason: 'correção de suporte' })

    expect(res.status).toBe(404)
    expect(corrections.calls).toEqual([])
  })

  it('exige senha recente e papel admin, e recusa id que não é uuid', async () => {
    const { app, user, userToken, staleAdminToken, adminToken, auth } = await buildApp()
    const url = `/admin/users/${user.id}/achievements/${ACHIEVEMENT_ID}/grant`
    const body = { reason: 'motivo válido' }

    expect((await request(app).post(url).set(auth(userToken)).send(body)).status).toBe(403)
    const stale = await request(app).post(url).set(auth(staleAdminToken)).send(body)
    expect(stale.status).toBe(401)
    expect(stale.body).toEqual({ error: 'reauth_required' })
    expect(
      (
        await request(app)
          .post(`/admin/users/${user.id}/lessons/nao-e-uuid/complete`)
          .set(auth(adminToken))
          .send(body)
      ).status,
    ).toBe(400)
  })
})

describe('GET /admin/users/:id/corrections', () => {
  it('devolve conquistas e lições do usuário em snake_case, só pra admin', async () => {
    const { app, adminToken, userToken, user, auth } = await buildApp()
    const url = `/admin/users/${user.id}/corrections`

    const res = await request(app).get(url).set(auth(adminToken))

    expect(res.status).toBe(200)
    expect(res.body.achievements).toEqual([
      { id: 'a1', name: 'Primeira Semana', description: null, unlocked: false },
    ])
    expect(res.body.lessons[0]).toEqual({
      id: 'l1',
      code: '0.1',
      title: 'Lição 0.1',
      track_number: 0,
      status: 'not_started',
    })
    expect((await request(app).get(url).set(auth(userToken))).status).toBe(403)
    expect(
      (await request(app).get(`/admin/users/${UNKNOWN_USER_ID}/corrections`).set(auth(adminToken)))
        .status,
    ).toBe(404)
  })
})
