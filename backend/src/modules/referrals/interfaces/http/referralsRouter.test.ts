import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { jsonErrorHandler } from '../../../../shared/http/errorHandler'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import { GetMyReferralUseCase } from '../../application/useCases/getMyReferral'
import { createFakeReferralRepository } from '../../test/fakes/fakes'
import { createReferralsRouter } from './referralsRouter'

function buildApp() {
  const referrals = createFakeReferralRepository()
  const tokenIssuer = createFakeTokenIssuer()
  const app = express()
  app.use(express.json())
  app.use(
    createReferralsRouter({
      getMyReferral: new GetMyReferralUseCase(referrals, () => 3),
      authMiddleware: createAuthMiddleware(tokenIssuer),
    }),
  )
  app.use(jsonErrorHandler)
  return { app, auth: (id: string) => `Bearer ${tokenIssuer.issue({ sub: id, role: 'user' })}` }
}

describe('GET /me/referral', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'segredo-de-teste'
  })

  it('401 sem token', async () => {
    const { app } = buildApp()
    expect((await request(app).get('/me/referral')).status).toBe(401)
  })

  it('devolve o código e as contagens, estável entre chamadas', async () => {
    const { app, auth } = buildApp()
    const first = await request(app).get('/me/referral').set('Authorization', auth('u1'))
    expect(first.status).toBe(200)
    expect(first.body.code).toMatch(/^[A-Z2-9]{8}$/)
    expect(first.body.qualifiedCount).toBe(0)
    expect(first.body.pendingCount).toBe(0)
    const second = await request(app).get('/me/referral').set('Authorization', auth('u1'))
    expect(second.body.code).toBe(first.body.code)
  })
})
