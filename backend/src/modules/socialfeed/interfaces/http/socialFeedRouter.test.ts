import express from 'express'
import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import { ListFeedForUserUseCase } from '../../application/useCases/listFeedForUser'
import { createFakeFriendGraphReader } from '../../test/fakes/fakeFriendGraphReader'
import { createFakeSocialFeedEventRepository } from '../../test/fakes/fakeSocialFeedEventRepository'
import { createFakeUserDirectory } from '../../test/fakes/fakeUserDirectory'
import { createSocialFeedRouter } from './socialFeedRouter'

async function buildApp() {
  const socialFeedEventRepository = createFakeSocialFeedEventRepository()
  await socialFeedEventRepository.record('friend-1', 'track_completed', 1)

  const listFeedForUser = new ListFeedForUserUseCase(
    createFakeFriendGraphReader({ u1: ['friend-1'] }),
    socialFeedEventRepository,
    createFakeUserDirectory([
      { id: 'friend-1', username: 'amigo1', name: 'Amigo Um', avatarUrl: null },
    ]),
  )
  const tokenIssuer = createFakeTokenIssuer()
  const authMiddleware = createAuthMiddleware(tokenIssuer)

  const app = express()
  app.use(express.json())
  app.use(createSocialFeedRouter({ listFeedForUser, authMiddleware }))
  return { app, tokenIssuer }
}

describe('social feed routes', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'segredo-de-teste'
  })

  it('GET /social-feed retorna 401 sem token', async () => {
    const { app } = await buildApp()

    const res = await request(app).get('/social-feed')

    expect(res.status).toBe(401)
  })

  it('GET /social-feed retorna os eventos dos amigos aceitos', async () => {
    const { app, tokenIssuer } = await buildApp()
    const token = tokenIssuer.issue({ sub: 'u1', role: 'user' })

    const res = await request(app).get('/social-feed').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.events).toHaveLength(1)
    expect(res.body.events[0]).toMatchObject({
      type: 'track_completed',
      trackNumber: 1,
      username: 'amigo1',
      name: 'Amigo Um',
    })
    expect(res.body.events[0]).not.toHaveProperty('netWorth')
  })
})
