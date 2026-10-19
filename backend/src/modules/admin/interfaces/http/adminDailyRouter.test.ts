import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { UserSessionGuard } from '../../../auth/application/services/userSessionGuard'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import { createFakeUserRepository } from '../../../auth/test/fakes/fakeUserRepository'
import {
  DailyAdminReadsUseCase,
  DailyContentAdminUseCase,
  DailyLaunchAdminUseCase,
  DailyPuzzleAdminUseCase,
} from '../../application/useCases/dailyAdmin'
import { RecordAdminActionUseCase } from '../../application/useCases/recordAdminAction'
import { createFakeAuditLogRepository } from '../../test/fakes/fakeAuditLogRepository'
import { createInMemoryDailyAdmin } from '../../test/fakes/inMemoryDailyAdmin'
import { createAdminDailyRouter } from './adminDailyRouter'

const START = '2026-11-10'

async function buildApp(startDate: string | null = null) {
  const { world, dailyAdmin } = createInMemoryDailyAdmin({
    startDate,
    now: '2026-10-20T12:00:00Z',
  })
  const userRepository = createFakeUserRepository()
  const tokenIssuer = createFakeTokenIssuer()
  const auditLog = createFakeAuditLogRepository()
  const record = new RecordAdminActionUseCase(auditLog)
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
    createAdminDailyRouter({
      reads: new DailyAdminReadsUseCase(dailyAdmin),
      launch: new DailyLaunchAdminUseCase(dailyAdmin, record),
      puzzles: new DailyPuzzleAdminUseCase(dailyAdmin, record),
      content: new DailyContentAdminUseCase(dailyAdmin, record),
      authMiddleware: createAuthMiddleware(tokenIssuer, new UserSessionGuard(userRepository)),
    }),
  )
  return {
    app,
    world,
    auditLog,
    auth: (token: string) => ({ Authorization: `Bearer ${token}` }),
    adminToken: tokenIssuer.issue({ sub: admin.id, role: 'admin' }),
    staleAdminToken: tokenIssuer.issue({ sub: admin.id, role: 'admin', authTime: 1000 }),
    userToken: tokenIssuer.issue({ sub: user.id, role: 'user' }),
  }
}

const ID = '11111111-1111-4111-8111-111111111111'

describe('permissões', () => {
  it.each([
    ['get', '/admin/daily'],
    ['get', '/admin/daily/metrics'],
    ['post', '/admin/daily/draft'],
    ['put', '/admin/daily/start-date'],
    ['post', '/admin/daily/puzzles/publish'],
    ['get', '/admin/daily/puzzles/1'],
    ['put', '/admin/daily/puzzles/1/card'],
    ['get', '/admin/daily/words'],
    ['post', '/admin/daily/words'],
    ['patch', `/admin/daily/words/${ID}`],
    ['get', '/admin/daily/accepted-words'],
    ['post', '/admin/daily/accepted-words'],
    ['delete', '/admin/daily/accepted-words/COPOM'],
    ['get', '/admin/daily/questions'],
    ['post', '/admin/daily/questions'],
    ['patch', `/admin/daily/questions/${ID}`],
    ['get', '/admin/daily/events'],
    ['post', '/admin/daily/events'],
    ['patch', `/admin/daily/events/${ID}`],
  ] as const)('%s %s exige token e papel admin', async (method, url) => {
    const { app, userToken, auth } = await buildApp()
    expect((await request(app)[method](url)).status).toBe(401)
    expect((await request(app)[method](url).set(auth(userToken))).status).toBe(403)
  })
})

describe('prévia de dia futuro', () => {
  it('só o admin vê, com o gabarito', async () => {
    const { app, adminToken, auth } = await buildApp()
    await request(app).post('/admin/daily/draft').set(auth(adminToken)).send({ start_date: START })

    const res = await request(app).get('/admin/daily/puzzles/20').set(auth(adminToken))
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ number: 20, date: '2026-11-29', is_today_or_past: false })
    expect(res.body.word.answer).toMatch(/^[A-Z]+$/)
    expect(res.body.question.correct_index).toBeTypeOf('number')
    expect(res.body.correct_order).toHaveLength(4)
  })

  it('jogo inexistente ou número malformado é 404', async () => {
    const { app, adminToken, auth } = await buildApp()
    expect((await request(app).get('/admin/daily/puzzles/5').set(auth(adminToken))).status).toBe(
      404,
    )
    expect((await request(app).get('/admin/daily/puzzles/abc').set(auth(adminToken))).status).toBe(
      404,
    )
    expect((await request(app).get('/admin/daily/puzzles/0').set(auth(adminToken))).status).toBe(
      404,
    )
  })
})

describe('estreia', () => {
  it('rascunho, agendamento e publicação em lote, tudo auditado', async () => {
    const { app, adminToken, auth, auditLog } = await buildApp()
    const refused = await request(app)
      .put('/admin/daily/start-date')
      .set(auth(adminToken))
      .send({ start_date: START })
    expect(refused.status).toBe(409)
    expect(refused.body.code).toBe('insufficient_content')

    const draft = await request(app)
      .post('/admin/daily/draft')
      .set(auth(adminToken))
      .send({ start_date: START })
    expect(draft.status).toBe(200)
    expect(draft.body).toMatchObject({ start_date: START, created: 30 })

    const scheduled = await request(app)
      .put('/admin/daily/start-date')
      .set(auth(adminToken))
      .send({ start_date: START })
    expect(scheduled.status).toBe(200)
    expect(scheduled.body).toMatchObject({ start_date: START, status: 'scheduled' })
    expect(scheduled.body.published).toHaveLength(30)

    const overview = await request(app).get('/admin/daily').set(auth(adminToken))
    expect(overview.body).toMatchObject({
      status: 'scheduled',
      start_date: START,
      ready_days_ahead: 30,
      published_days_ahead: 30,
      alerts: [],
      bank: { words: 60, questions: 60, events: 200, accepted_extra: 1 },
    })

    const actions = auditLog.entries.map((e) => `${e.action}:${e.result}`)
    expect(actions).toContain('daily.draft:success')
    expect(actions).toContain('daily.start_date:failed')
    expect(actions).toContain('daily.start_date:success')
  })

  it('mudar a data exige senha recente', async () => {
    const { app, staleAdminToken, auth } = await buildApp()
    const res = await request(app)
      .put('/admin/daily/start-date')
      .set(auth(staleAdminToken))
      .send({ start_date: START })
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: 'reauth_required' })
  })

  it('data malformada é 400 e já no ar é 409', async () => {
    const { app, adminToken, auth } = await buildApp('2026-10-01')
    const bad = await request(app)
      .put('/admin/daily/start-date')
      .set(auth(adminToken))
      .send({ start_date: '10/11/2026' })
    expect(bad.status).toBe(400)
    const live = await request(app)
      .put('/admin/daily/start-date')
      .set(auth(adminToken))
      .send({ start_date: null })
    expect(live.status).toBe(409)
    expect(live.body.code).toBe('already_started')
  })
})

describe('publicar e trocar cartão', () => {
  it('publicar sem números publica todos os jogos que ainda não estão no ar', async () => {
    const { app, adminToken, auth } = await buildApp()
    await request(app).post('/admin/daily/draft').set(auth(adminToken)).send({ start_date: START })
    const res = await request(app)
      .post('/admin/daily/puzzles/publish')
      .set(auth(adminToken))
      .send({})
    expect(res.status).toBe(200)
    expect(res.body.published).toHaveLength(30)
  })

  it('jogo publicado só troca com confirm_published', async () => {
    const { app, adminToken, auth, world } = await buildApp()
    await request(app).post('/admin/daily/draft').set(auth(adminToken)).send({ start_date: START })
    await request(app)
      .post('/admin/daily/puzzles/publish')
      .set(auth(adminToken))
      .send({ numbers: [1] })
    const word = '33333333-3333-4333-8333-333333333333'
    world.words.items[55].id = word

    const refused = await request(app)
      .put('/admin/daily/puzzles/1/card')
      .set(auth(adminToken))
      .send({ card: 'word', word_id: word })
    expect(refused.status).toBe(409)
    expect(refused.body.code).toBe('confirmation_required')

    const ok = await request(app)
      .put('/admin/daily/puzzles/1/card')
      .set(auth(adminToken))
      .send({ card: 'word', word_id: word, confirm_published: true })
    expect(ok.status).toBe(200)
  })

  it('corpo de cartão inválido é 400', async () => {
    const { app, adminToken, auth } = await buildApp()
    const res = await request(app)
      .put('/admin/daily/puzzles/1/card')
      .set(auth(adminToken))
      .send({ card: 'timeline', event_ids: [ID] })
    expect(res.status).toBe(400)
  })
})

describe('conteúdo', () => {
  it('palavra-resposta fora da lista aceita é 422 com os motivos', async () => {
    const { app, adminToken, auth } = await buildApp()
    const res = await request(app).post('/admin/daily/words').set(auth(adminToken)).send({
      display: 'Zzyzx',
      definition: 'Nada.',
      category: 'instituicoes',
      scope: 'brasil',
      learn_more: null,
    })
    expect(res.status).toBe(422)
    expect(res.body).toMatchObject({
      code: 'invalid_daily_content',
      problems: ['palavra Zzyzx: fora da lista aceita'],
    })
  })

  it('cria palavra aceita e a lista; a auditoria leva a chave, não o texto', async () => {
    const { app, adminToken, auth, auditLog } = await buildApp()
    const created = await request(app)
      .post('/admin/daily/words')
      .set(auth(adminToken))
      .send({
        display: 'Selic',
        definition: 'Taxa básica de juros.',
        category: 'juros-e-inflacao',
        scope: 'brasil',
        learn_more: { kind: 'glossary', ref: 'Selic' },
      })
    expect(created.status).toBe(201)
    expect(created.body.word).toMatchObject({ answer: 'SELIC', learn_more: { kind: 'glossary' } })
    const list = await request(app).get('/admin/daily/words').set(auth(adminToken))
    expect(list.body.words.some((w: { answer: string }) => w.answer === 'SELIC')).toBe(true)
    const entry = auditLog.entries.find((e) => e.action === 'daily.word_create')!
    expect(JSON.stringify(entry.payload)).not.toContain('Taxa básica')
  })

  it('pergunta sem fonte é 400 (formato) ou 422 (regra)', async () => {
    const { app, adminToken, auth } = await buildApp()
    const base = {
      question: 'Pergunta?',
      options: ['a', 'b'],
      correct_index: 0,
      explanation: 'Porque sim.',
      category: 'instituicoes',
      scope: 'brasil',
      learn_more: null,
    }
    const missing = await request(app)
      .post('/admin/daily/questions')
      .set(auth(adminToken))
      .send(base)
    expect(missing.status).toBe(400)
    const outOfRange = await request(app)
      .post('/admin/daily/questions')
      .set(auth(adminToken))
      .send({ ...base, source_ref: 'BCB', correct_index: 3 })
    expect(outOfRange.status).toBe(422)
  })

  it('edita evento, devolve os jogos afetados e mapeia 404 de item inexistente', async () => {
    const { app, adminToken, auth, world } = await buildApp()
    await request(app).post('/admin/daily/draft').set(auth(adminToken)).send({ start_date: START })
    const used = world.puzzles.items[0].timelineEventIds[0]
    const uuid = '22222222-2222-4222-8222-222222222222'
    world.events.items.find((e) => e.id === used)!.id = uuid
    world.puzzles.items[0].timelineEventIds[0] = uuid

    const res = await request(app)
      .patch(`/admin/daily/events/${uuid}`)
      .set(auth(adminToken))
      .send({ active: false })
    expect(res.status).toBe(200)
    expect(res.body.affected_puzzles).toContain(1)
    expect(res.body.event.active).toBe(false)

    const missing = await request(app)
      .patch(`/admin/daily/events/${ID}`)
      .set(auth(adminToken))
      .send({ active: false })
    expect(missing.status).toBe(404)
  })

  it('PATCH sem nenhum campo é 400', async () => {
    const { app, adminToken, auth } = await buildApp()
    const res = await request(app)
      .patch(`/admin/daily/questions/${ID}`)
      .set(auth(adminToken))
      .send({ confirm_published: true })
    expect(res.status).toBe(400)
  })

  it('lista extra: adiciona, repete (409), remove e recusa remover palavra-resposta', async () => {
    const { app, adminToken, auth } = await buildApp()
    const add = await request(app)
      .post('/admin/daily/accepted-words')
      .set(auth(adminToken))
      .send({ word: 'copom' })
    expect(add.status).toBe(201)
    expect(add.body).toEqual({ word: 'COPOM' })
    expect(
      (
        await request(app)
          .post('/admin/daily/accepted-words')
          .set(auth(adminToken))
          .send({ word: 'copom' })
      ).status,
    ).toBe(409)
    expect(
      (await request(app).delete('/admin/daily/accepted-words/copom').set(auth(adminToken))).status,
    ).toBe(200)
    expect(
      (await request(app).delete('/admin/daily/accepted-words/copom').set(auth(adminToken))).status,
    ).toBe(404)
  })
})

describe('GET /admin/daily/metrics (DI.7.1)', () => {
  it('devolve um dia por linha, do mais recente ao mais antigo, com zeros', async () => {
    const { app, world, adminToken, auth } = await buildApp()
    await world.metricsRepo.increment('2026-10-20', 'anon_started')
    await world.metricsRepo.increment('2026-10-20', 'origin_signup')

    const res = await request(app).get('/admin/daily/metrics?days=3').set(auth(adminToken))

    expect(res.status).toBe(200)
    expect(res.body.days.map((d: { date: string }) => d.date)).toEqual([
      '2026-10-20',
      '2026-10-19',
      '2026-10-18',
    ])
    expect(res.body.days[0]).toEqual({
      date: '2026-10-20',
      anon_started: 1,
      anon_completed: 0,
      logged_started: 0,
      logged_completed: 0,
      signups: 1,
      logins: 0,
    })
    expect(res.body.days[1].anon_started).toBe(0)
  })

  it('days fora de 1 a 90 é 400', async () => {
    const { app, adminToken, auth } = await buildApp()
    for (const days of ['0', '91', 'x']) {
      const res = await request(app).get(`/admin/daily/metrics?days=${days}`).set(auth(adminToken))
      expect(res.status).toBe(400)
    }
  })
})
