import express from 'express'
import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import {
  CreateAnnouncementUseCase,
  ListActiveAnnouncementsUseCase,
} from '../../application/useCases/announcements'
import { FakeAnnouncementRepository } from '../../test/fakes/fakeAnnouncementRepository'
import { createAnnouncementsRouter } from './announcementsRouter'

const NOW = new Date('2026-10-06T12:00:00Z')
const hour = 3_600_000
const clock = () => NOW

describe('GET /announcements', () => {
  async function build() {
    const tokenIssuer = createFakeTokenIssuer()
    const repository = new FakeAnnouncementRepository()
    const create = new CreateAnnouncementUseCase(repository, clock)
    const base = { body: 'Texto', severity: 'info' as const, dismissible: true }
    await create.execute({
      createdBy: 'a',
      draft: {
        ...base,
        title: 'No ar',
        startsAt: new Date(NOW.getTime() - hour),
        endsAt: new Date(NOW.getTime() + hour),
      },
    })
    await create.execute({
      createdBy: 'a',
      draft: { ...base, title: 'Agendado', startsAt: new Date(NOW.getTime() + hour), endsAt: null },
    })
    await create.execute({
      createdBy: 'a',
      draft: {
        ...base,
        title: 'Já terminou',
        startsAt: new Date(NOW.getTime() - 2 * hour),
        endsAt: new Date(NOW.getTime() - hour),
      },
    })
    const app = express()
    app.use(
      createAnnouncementsRouter({
        listActiveAnnouncements: new ListActiveAnnouncementsUseCase(repository, clock),
        authMiddleware: createAuthMiddleware(tokenIssuer),
      }),
    )
    return { app, token: `Bearer ${tokenIssuer.issue({ sub: 'user-1', role: 'user' })}` }
  }

  it('retorna 401 sem token', async () => {
    const { app } = await build()
    expect((await request(app).get('/announcements')).status).toBe(401)
  })

  it('devolve só o que está dentro da janela, sem campos internos', async () => {
    const { app, token } = await build()
    const res = await request(app).get('/announcements').set('Authorization', token)
    expect(res.status).toBe(200)
    expect(res.body.announcements).toHaveLength(1)
    expect(res.body.announcements[0]).toEqual({
      id: expect.any(String),
      title: 'No ar',
      body: 'Texto',
      severity: 'info',
      kind: 'notice',
      dismissible: true,
      starts_at: new Date(NOW.getTime() - hour).toISOString(),
      ends_at: new Date(NOW.getTime() + hour).toISOString(),
    })
  })
})
