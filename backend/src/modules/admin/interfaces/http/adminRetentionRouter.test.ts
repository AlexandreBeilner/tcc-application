import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import { GetActiveUsersUseCase } from '../../application/useCases/getActiveUsers'
import { GetMilestoneTimesUseCase } from '../../application/useCases/getMilestoneTimes'
import { GetRetentionCohortsUseCase } from '../../application/useCases/getRetentionCohorts'
import { createInMemoryRetentionReader } from '../../test/fakes/inMemoryRetentionReader'
import { buildSyntheticRetention } from '../../test/retentionDataset'
import { createAdminRetentionRouter } from './adminRetentionRouter'

const NOW = new Date('2026-10-18T15:00:00Z')

function buildApp() {
  const tokenIssuer = createFakeTokenIssuer()
  const reader = createInMemoryRetentionReader(
    buildSyntheticRetention({
      users: 1500,
      today: '2026-10-18',
      firstSignupDay: '2026-04-06',
      presenceSince: '2026-06-01',
      activitySince: '2026-05-01',
    }),
  )
  const app = express()
  app.use(
    createAdminRetentionRouter({
      getRetentionCohorts: new GetRetentionCohortsUseCase(reader, () => NOW),
      getActiveUsers: new GetActiveUsersUseCase(reader, () => NOW),
      getMilestoneTimes: new GetMilestoneTimesUseCase(reader, () => NOW),
      authMiddleware: createAuthMiddleware(tokenIssuer),
    }),
  )
  return {
    app,
    admin: `Bearer ${tokenIssuer.issue({ sub: 'admin-1', role: 'admin' })}`,
    user: `Bearer ${tokenIssuer.issue({ sub: 'user-1', role: 'user' })}`,
  }
}

describe('GET /admin/retention', () => {
  it('401 sem token e 403 para quem não é admin', async () => {
    const { app, user } = buildApp()
    expect((await request(app).get('/admin/retention')).status).toBe(401)
    expect((await request(app).get('/admin/retention').set('Authorization', user)).status).toBe(403)
  })

  it('devolve coortes, ativos por dia e marcos, com os padrões de 12 semanas e 60 dias', async () => {
    const { app, admin } = buildApp()
    const res = await request(app).get('/admin/retention').set('Authorization', admin)

    expect(res.status).toBe(200)
    expect(res.body.cohorts.cohorts).toHaveLength(12)
    expect(res.body.cohorts.cohorts[0].cohort_week).toBe('2026-10-12')
    expect(res.body.cohorts.cohorts[0].returned.d30).toMatchObject({
      status: 'in_progress',
      rate: null,
    })
    expect(res.body.active.days).toHaveLength(60)
    expect(res.body.active.days.at(-1).day).toBe('2026-10-17')
    expect(res.body.milestones.milestones).toHaveLength(5)
    expect(res.body.milestones.tracking_since).toBe('2026-06-02')
  })

  it('respeita weeks e days', async () => {
    const { app, admin } = buildApp()
    const res = await request(app)
      .get('/admin/retention?weeks=4&days=14')
      .set('Authorization', admin)
    expect(res.status).toBe(200)
    expect(res.body.cohorts.cohorts).toHaveLength(4)
    expect(res.body.active.days).toHaveLength(14)
  })

  it.each(['weeks=0', 'weeks=53', 'weeks=abc', 'days=6', 'days=181', 'days=1.5'])(
    '400 para %s',
    async (query) => {
      const { app, admin } = buildApp()
      const res = await request(app).get(`/admin/retention?${query}`).set('Authorization', admin)
      expect(res.status).toBe(400)
      expect(res.body.error).toBe('parâmetros do painel de retenção inválidos')
    },
  )

  it('não expõe nenhuma pessoa: só números agregados (RP4, RNF09)', async () => {
    const { app, admin } = buildApp()
    const res = await request(app).get('/admin/retention').set('Authorization', admin)
    expect(JSON.stringify(res.body)).not.toMatch(/user-\d|@|"email"|"username"|"user_id"/)
  })
})
