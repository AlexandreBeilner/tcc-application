import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import type { Achievement } from '../../../achievements/domain/achievement'
import { UserSessionGuard } from '../../../auth/application/services/userSessionGuard'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import { createFakeUserRepository } from '../../../auth/test/fakes/fakeUserRepository'
import type { Mission } from '../../../missions/domain/mission'
import type { AdminRanking } from '../../application/ports/adminRankingReader'
import {
  CreateAchievementAdminUseCase,
  ListAchievementCatalogUseCase as ListAchievementCatalogAdminUseCase,
  ListMissionCatalogUseCase as ListMissionCatalogAdminUseCase,
  UpdateAchievementAdminUseCase,
  UpdateMissionAdminUseCase,
} from '../../application/useCases/gamificationCatalog'
import { GetAdminRankingUseCase } from '../../application/useCases/getAdminRanking'
import { RecordAdminActionUseCase } from '../../application/useCases/recordAdminAction'
import { createFakeAuditLogRepository } from '../../test/fakes/fakeAuditLogRepository'
import {
  createFakeAdminRankingReader,
  createInMemoryGamificationCatalogAdmin,
} from '../../test/fakes/inMemoryGamificationCatalogAdmin'
import { createAdminGamificationRouter } from './adminGamificationRouter'

const ACH_ID = '6f9619ff-8b86-d011-b42d-00c04fc964aa'
const MISSION_ID = '6f9619ff-8b86-d011-b42d-00c04fc964bb'
const UNKNOWN_ID = '6f9619ff-8b86-d011-b42d-00c04fc964ff'

const streak7: Achievement = {
  id: ACH_ID,
  name: 'Primeira Semana',
  description: 'Sete dias seguidos.',
  criteriaType: 'streak_days',
  criteriaValue: 7,
  isActive: true,
  isRare: false,
}

const feedRead: Mission = {
  id: MISSION_ID,
  key: 'feed_read',
  title: 'Consulte o feed de notícias',
  description: null,
  completionCriteria: 'Reportado pelo cliente',
  xpReward: 30,
  requiresLessonCompletion: false,
  isActive: true,
}

async function buildApp() {
  const userRepository = createFakeUserRepository()
  const tokenIssuer = createFakeTokenIssuer()
  const auditLog = createFakeAuditLogRepository()
  const record = new RecordAdminActionUseCase(auditLog)
  const { catalogAdmin, achievementRepository, missionRepository } =
    createInMemoryGamificationCatalogAdmin({ achievements: [streak7], missions: [feedRead] })
  const rankingReader = createFakeAdminRankingReader({
    window: 'week',
    windowStart: new Date('2026-10-05T00:00:00.000Z'),
    windowEnd: new Date('2026-10-11T23:59:59.999Z'),
    criterion: 'overall',
    entries: [
      { position: 26, userId: 'u1', username: 'maria', level: 3, xp: 400, profitabilityPct: 12.5 },
      { position: 27, userId: 'u2', username: 'joao', level: 2, xp: 150, profitabilityPct: -1.2 },
    ],
    page: 2,
    pageSize: 25,
    totalEntries: 27,
    totalPages: 2,
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
    createAdminGamificationRouter({
      listAchievementCatalog: new ListAchievementCatalogAdminUseCase(catalogAdmin),
      createAchievement: new CreateAchievementAdminUseCase(catalogAdmin, record),
      updateAchievement: new UpdateAchievementAdminUseCase(catalogAdmin, record),
      listMissionCatalog: new ListMissionCatalogAdminUseCase(catalogAdmin),
      updateMission: new UpdateMissionAdminUseCase(catalogAdmin, record),
      getAdminRanking: new GetAdminRankingUseCase(rankingReader),
      authMiddleware: createAuthMiddleware(tokenIssuer, new UserSessionGuard(userRepository)),
    }),
  )
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` })
  return {
    app,
    auditLog,
    rankingReader,
    achievementRepository,
    missionRepository,
    auth,
    adminId: admin.id,
    adminToken: tokenIssuer.issue({ sub: admin.id, role: 'admin' }),
    userToken: tokenIssuer.issue({ sub: user.id, role: 'user' }),
  }
}

describe('permissões', () => {
  it.each([
    ['get', '/admin/gamification/achievements'],
    ['post', '/admin/gamification/achievements'],
    ['patch', `/admin/gamification/achievements/${ACH_ID}`],
    ['get', '/admin/gamification/missions'],
    ['patch', `/admin/gamification/missions/${MISSION_ID}`],
    ['get', '/admin/gamification/ranking?window=week'],
  ] as const)('%s %s exige token e papel admin', async (method, url) => {
    const { app, userToken, auth } = await buildApp()

    expect((await request(app)[method](url)).status).toBe(401)
    expect((await request(app)[method](url).set(auth(userToken))).status).toBe(403)
  })
})

describe('GET /admin/gamification/achievements', () => {
  it('lista o catálogo com a contagem de quem ganhou e a lista fechada de critérios', async () => {
    const { app, adminToken, auth, achievementRepository } = await buildApp()
    await achievementRepository.unlock('u1', ACH_ID)
    await achievementRepository.unlock('u2', ACH_ID)

    const res = await request(app).get('/admin/gamification/achievements').set(auth(adminToken))

    expect(res.status).toBe(200)
    expect(res.body.achievements).toEqual([
      {
        id: ACH_ID,
        name: 'Primeira Semana',
        description: 'Sete dias seguidos.',
        criteria_type: 'streak_days',
        criteria_value: 7,
        is_active: true,
        is_rare: false,
        unlocked_count: 2,
      },
    ])
    expect(res.body.criteria.map((c: { type: string }) => c.type)).toEqual([
      'net_worth',
      'streak_days',
      'lessons_completed',
      'trades_executed',
      'micro_decisions_streak',
      'track_completed_no_errors',
      'lesson_reviewed',
      'assemblies_participated',
      'referrals_qualified',
      'daily_word_first_try',
      'daily_perfect_days',
    ])
    expect(res.body.criteria[0]).toEqual({
      type: 'net_worth',
      label: 'Patrimônio (R$)',
      value_kind: 'currency',
    })
  })
})

describe('POST /admin/gamification/achievements', () => {
  it('cria ativa e audita o que foi pedido com o id criado', async () => {
    const { app, adminToken, auth, auditLog, adminId } = await buildApp()

    const res = await request(app)
      .post('/admin/gamification/achievements')
      .set(auth(adminToken))
      .send({
        name: 'Trader Ativo',
        description: 'Execute 20 operações.',
        criteria_type: 'trades_executed',
        criteria_value: 20,
      })

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      name: 'Trader Ativo',
      criteria_type: 'trades_executed',
      criteria_value: 20,
      is_active: true,
      unlocked_count: 0,
    })
    expect(auditLog.entries[0]).toMatchObject({
      adminId,
      action: 'achievement.create',
      targetType: 'achievement',
      targetId: res.body.id,
      result: 'success',
      payload: { name: 'Trader Ativo', criteria_type: 'trades_executed', criteria_value: 20 },
    })
  })

  it.each([
    ['nome vazio', { name: ' ', criteria_type: 'streak_days', criteria_value: 5 }],
    [
      'critério fora da lista fechada',
      { name: 'X', criteria_type: 'expressao', criteria_value: 5 },
    ],
    ['meta zero', { name: 'X', criteria_type: 'streak_days', criteria_value: 0 }],
    ['meta ausente', { name: 'X', criteria_type: 'streak_days' }],
    ['meta em texto', { name: 'X', criteria_type: 'streak_days', criteria_value: 'dez' }],
  ])('recusa %s com 400, sem gravar nem auditar', async (_name, body) => {
    const { app, adminToken, auth, auditLog } = await buildApp()

    const res = await request(app)
      .post('/admin/gamification/achievements')
      .set(auth(adminToken))
      .send(body)

    expect(res.status).toBe(400)
    expect(auditLog.entries).toEqual([])
  })

  it('recusa meta fracionada num critério de contagem (422) e nome repetido (409), e audita a falha', async () => {
    const { app, adminToken, auth, auditLog } = await buildApp()
    const post = (body: object) =>
      request(app).post('/admin/gamification/achievements').set(auth(adminToken)).send(body)

    const fractional = await post({
      name: 'Nova',
      criteria_type: 'streak_days',
      criteria_value: 7.5,
    })
    const duplicate = await post({
      name: 'primeira semana',
      criteria_type: 'streak_days',
      criteria_value: 3,
    })

    expect(fractional.status).toBe(422)
    expect(fractional.body.code).toBe('invalid_catalog_entry')
    expect(duplicate.status).toBe(409)
    expect(auditLog.entries.map((e) => e.result)).toEqual(['failed', 'failed'])
  })
})

describe('PATCH /admin/gamification/achievements/:id', () => {
  it('edita e liga/desliga, devolvendo a conquista atualizada, e audita só o que mudou', async () => {
    const { app, adminToken, auth, auditLog } = await buildApp()

    const res = await request(app)
      .patch(`/admin/gamification/achievements/${ACH_ID}`)
      .set(auth(adminToken))
      .send({ criteria_value: 10, is_active: false })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ id: ACH_ID, criteria_value: 10, is_active: false })
    expect(auditLog.entries[0]).toMatchObject({
      action: 'achievement.update',
      targetId: ACH_ID,
      payload: { criteria_value: 10, is_active: false },
    })
    expect(auditLog.entries[0].payload).not.toHaveProperty('name')
  })

  it('marca a conquista como rara (ponto 044) e audita o campo', async () => {
    const { app, adminToken, auth, auditLog } = await buildApp()

    const res = await request(app)
      .patch(`/admin/gamification/achievements/${ACH_ID}`)
      .set(auth(adminToken))
      .send({ is_rare: true })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ id: ACH_ID, is_rare: true })
    expect(auditLog.entries[0].payload).toMatchObject({ is_rare: true })
  })

  it('recusa corpo vazio e id que não é uuid (400), inexistente (404) e meta inválida (422)', async () => {
    const { app, adminToken, auth } = await buildApp()
    const patch = (id: string, body: object) =>
      request(app).patch(`/admin/gamification/achievements/${id}`).set(auth(adminToken)).send(body)

    expect((await patch(ACH_ID, {})).status).toBe(400)
    expect((await patch('abc', { is_active: false })).status).toBe(400)
    expect((await patch(UNKNOWN_ID, { is_active: false })).status).toBe(404)
    expect((await patch(ACH_ID, { criteria_value: 7.5 })).status).toBe(422)
  })
})

describe('missões', () => {
  it('GET lista com o tipo de verificação e quantos usuários concluíram', async () => {
    const { app, adminToken, auth, missionRepository } = await buildApp()
    await missionRepository.markCompleted('u1', MISSION_ID, '2026-10-03')
    await missionRepository.markCompleted('u2', MISSION_ID, '2026-10-01')

    const res = await request(app).get('/admin/gamification/missions').set(auth(adminToken))

    expect(res.status).toBe(200)
    expect(res.body.missions).toEqual([
      {
        id: MISSION_ID,
        key: 'feed_read',
        title: 'Consulte o feed de notícias',
        description: null,
        completion_criteria: 'Reportado pelo cliente',
        xp_reward: 30,
        is_active: true,
        verification: 'client_reported',
        completed_users: 2,
        completed_today: 1,
      },
    ])
  })

  it('PATCH edita texto, XP e liga/desliga, e audita', async () => {
    const { app, adminToken, auth, auditLog } = await buildApp()

    const res = await request(app)
      .patch(`/admin/gamification/missions/${MISSION_ID}`)
      .set(auth(adminToken))
      .send({ title: 'Leia o feed', xp_reward: 45, is_active: false })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ title: 'Leia o feed', xp_reward: 45, is_active: false })
    expect(auditLog.entries[0]).toMatchObject({
      action: 'mission.update',
      targetType: 'mission',
      targetId: MISSION_ID,
      payload: { title: 'Leia o feed', xp_reward: 45, is_active: false, key: 'feed_read' },
    })
  })

  it('PATCH recusa corpo vazio e id inválido (400), inexistente (404) e XP fora da faixa (422)', async () => {
    const { app, adminToken, auth } = await buildApp()
    const patch = (id: string, body: object) =>
      request(app).patch(`/admin/gamification/missions/${id}`).set(auth(adminToken)).send(body)

    expect((await patch(MISSION_ID, {})).status).toBe(400)
    expect((await patch('abc', { is_active: false })).status).toBe(400)
    expect((await patch(UNKNOWN_ID, { is_active: false })).status).toBe(404)
    expect((await patch(MISSION_ID, { xp_reward: 0 })).status).toBe(422)
    expect((await patch(MISSION_ID, { xp_reward: 100000 })).status).toBe(422)
    expect((await patch(MISSION_ID, { xp_reward: 1.5 })).status).toBe(400)
  })
})

describe('GET /admin/gamification/ranking', () => {
  it('devolve a janela corrente com início e fim, e as posições da página, sem patrimônio', async () => {
    const { app, adminToken, auth, rankingReader } = await buildApp()

    const res = await request(app)
      .get('/admin/gamification/ranking?window=week&criterion=overall&page=2')
      .set(auth(adminToken))

    expect(res.status).toBe(200)
    expect(rankingReader.queries).toEqual([{ window: 'week', criterion: 'overall', page: 2 }])
    expect(res.body.window_start).toBe('2026-10-05T00:00:00.000Z')
    expect(res.body.window_end).toBe('2026-10-11T23:59:59.999Z')
    expect(res.body.entries).toEqual([
      {
        position: 26,
        user_id: 'u1',
        username: 'maria',
        level: 3,
        xp: 400,
        profitability_pct: 12.5,
      },
      { position: 27, user_id: 'u2', username: 'joao', level: 2, xp: 150, profitability_pct: -1.2 },
    ])
    expect(res.body).toMatchObject({ page: 2, page_size: 25, total_entries: 27, total_pages: 2 })
    expect(JSON.stringify(res.body)).not.toMatch(/net_worth|patrimonio|cash/)
  })

  it('exige window, exceto no critério de nível', async () => {
    const { app, adminToken, auth, rankingReader } = await buildApp()
    const levelRanking: AdminRanking = {
      window: null,
      windowStart: null,
      windowEnd: null,
      criterion: 'level',
      entries: [],
      page: 1,
      pageSize: 25,
      totalEntries: 0,
      totalPages: 0,
    }
    rankingReader.next = levelRanking

    const missing = await request(app).get('/admin/gamification/ranking').set(auth(adminToken))
    const level = await request(app)
      .get('/admin/gamification/ranking?criterion=level')
      .set(auth(adminToken))

    expect(missing.status).toBe(400)
    expect(level.status).toBe(200)
    expect(level.body).toMatchObject({ window: null, window_start: null, window_end: null })
  })
})
