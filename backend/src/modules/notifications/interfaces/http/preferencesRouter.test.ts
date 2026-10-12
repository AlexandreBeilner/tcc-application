import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import { GetEmailPreferencesUseCase } from '../../application/useCases/getEmailPreferences'
import { UnsubscribeByTokenUseCase } from '../../application/useCases/unsubscribeByToken'
import { UpdateEmailPreferencesUseCase } from '../../application/useCases/updateEmailPreferences'
import { createFakeEmailPreferencesRepository } from '../../test/fakes/fakeEmailPreferencesRepository'
import { createFakeEmailSuppressionRepository } from '../../test/fakes/fakeEmailSuppressionRepository'
import { createFakeRecipientDirectory } from '../../test/fakes/fakeRecipientDirectory'
import { createFakeUnsubscribeTokens } from '../../test/fakes/fakeUnsubscribe'
import { createEmailPreferencesRouter } from './preferencesRouter'

function buildApp(suppressions: Record<string, 'bounce' | 'complaint'> = {}) {
  const preferences = createFakeEmailPreferencesRepository({ u1: { social: true } })
  const tokenIssuer = createFakeTokenIssuer()
  const app = express()
  app.use(express.json())
  app.use(
    createEmailPreferencesRouter({
      getEmailPreferences: new GetEmailPreferencesUseCase(
        preferences,
        createFakeRecipientDirectory({
          u1: { address: 'ana@exemplo.com', status: 'active', emailVerified: true },
        }),
        createFakeEmailSuppressionRepository(suppressions),
      ),
      updateEmailPreferences: new UpdateEmailPreferencesUseCase(preferences),
      unsubscribeByToken: new UnsubscribeByTokenUseCase(createFakeUnsubscribeTokens(), preferences),
      authMiddleware: createAuthMiddleware(tokenIssuer),
      unsubscribePageUrl: 'https://app.test/cancelar-inscricao',
    }),
  )
  const auth = `Bearer ${tokenIssuer.issue({ sub: 'u1', role: 'user' })}`
  return { app, preferences, auth }
}

describe('GET /me/email-preferences', () => {
  it('401 sem token', async () => {
    const { app } = buildApp()
    expect((await request(app).get('/me/email-preferences')).status).toBe(401)
  })

  it('devolve as preferências e o motivo da supressão do endereço', async () => {
    const { app, auth } = buildApp({ 'ana@exemplo.com': 'bounce' })

    const res = await request(app).get('/me/email-preferences').set('Authorization', auth)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      preferences: { social: true, engagement: false },
      suppression: 'bounce',
    })
  })
})

describe('PATCH /me/email-preferences', () => {
  it('liga uma categoria e mantém a outra', async () => {
    const { app, auth } = buildApp()

    const res = await request(app)
      .patch('/me/email-preferences')
      .set('Authorization', auth)
      .send({ engagement: true })

    expect(res.status).toBe(200)
    expect(res.body.preferences).toEqual({ social: true, engagement: true })
  })

  it.each([
    ['corpo vazio', {}],
    ['categoria obrigatória (não desligável)', { security: false }],
    ['tipo errado', { social: 'sim' }],
  ])('400 com %s', async (_label, body) => {
    const { app, auth, preferences } = buildApp()

    const res = await request(app)
      .patch('/me/email-preferences')
      .set('Authorization', auth)
      .send(body)

    expect(res.status).toBe(400)
    expect(await preferences.get('u1')).toEqual({ social: true, engagement: false })
  })

  it('401 sem token', async () => {
    const { app } = buildApp()
    expect((await request(app).patch('/me/email-preferences').send({ social: false })).status).toBe(
      401,
    )
  })
})

describe('/email/unsubscribe', () => {
  it('GET só redireciona para a página de confirmação e não cancela nada', async () => {
    const { app, preferences } = buildApp()

    const res = await request(app).get('/email/unsubscribe?token=u1|social')

    expect(res.status).toBe(302)
    expect(res.headers.location).toBe('https://app.test/cancelar-inscricao#token=u1%7Csocial')
    expect(await preferences.get('u1')).toEqual({ social: true, engagement: false })
  })

  it('GET sem token => 400', async () => {
    const { app } = buildApp()
    expect((await request(app).get('/email/unsubscribe')).status).toBe(400)
  })

  it('POST com o token na query (one-click do cliente de e-mail) cancela, sem login', async () => {
    const { app, preferences } = buildApp()

    const res = await request(app)
      .post('/email/unsubscribe?token=u1|social')
      .type('form')
      .send({ 'List-Unsubscribe': 'One-Click' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'cancelado', category: 'social' })
    expect(await preferences.get('u1')).toEqual({ social: false, engagement: false })
  })

  it('POST com o token no corpo JSON (página do frontend) cancela', async () => {
    const { app, preferences } = buildApp()

    const res = await request(app).post('/email/unsubscribe').send({ token: 'u1|social' })

    expect(res.status).toBe(200)
    expect(await preferences.get('u1')).toEqual({ social: false, engagement: false })
  })

  it('POST com token inválido => 400 e nada muda', async () => {
    const { app, preferences } = buildApp()

    const res = await request(app).post('/email/unsubscribe').send({ token: 'lixo' })

    expect(res.status).toBe(400)
    expect(await preferences.get('u1')).toEqual({ social: true, engagement: false })
  })

  it('POST sem token => 400', async () => {
    const { app } = buildApp()
    expect((await request(app).post('/email/unsubscribe').send({})).status).toBe(400)
  })
})
