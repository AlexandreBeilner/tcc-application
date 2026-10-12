import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { InvalidWebhookSignatureError } from '../../domain/errors'
import type { ReceiveProviderWebhookUseCase } from '../../application/useCases/receiveProviderWebhook'
import { createEmailWebhookRouter } from './webhookRouter'

function appWith(execute: ReceiveProviderWebhookUseCase['execute']) {
  const app = express()
  // Igual ao `app.ts`: o webhook entra antes do `express.json()`.
  app.use('/webhooks', createEmailWebhookRouter({ receiveProviderWebhook: { execute } as never }))
  app.use(express.json())
  return app
}

const signedHeaders = { 'svix-id': 'msg_1', 'svix-timestamp': '1', 'svix-signature': 'v1,x' }

describe('POST /webhooks/resend', () => {
  it('entrega o corpo bruto (bytes idênticos) e os cabeçalhos svix ao caso de uso', async () => {
    const calls: Parameters<ReceiveProviderWebhookUseCase['execute']>[0][] = []
    const app = appWith(async (req) => {
      calls.push(req)
      return 'delivered'
    })
    const body = '{"type":"email.delivered",  "data":{"email_id":"em_1"}}'

    const res = await request(app)
      .post('/webhooks/resend')
      .set(signedHeaders)
      .set('content-type', 'application/json')
      .send(body)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ received: true, handled: 'delivered' })
    expect(calls).toEqual([
      { rawBody: body, headers: { id: 'msg_1', timestamp: '1', signature: 'v1,x' } },
    ])
  })

  it('400 sem cabeçalhos de assinatura, sem chamar o caso de uso', async () => {
    let called = false
    const app = appWith(async () => {
      called = true
      return 'ignored'
    })

    const res = await request(app).post('/webhooks/resend').send({ a: 1 })

    expect(res.status).toBe(400)
    expect(called).toBe(false)
  })

  it('400 com assinatura inválida', async () => {
    const app = appWith(async () => {
      throw new InvalidWebhookSignatureError()
    })

    const res = await request(app)
      .post('/webhooks/resend')
      .set(signedHeaders)
      .set('content-type', 'application/json')
      .send('{}')

    expect(res.status).toBe(400)
  })

  it('500 em erro nosso (o provedor reenvia)', async () => {
    const app = appWith(async () => {
      throw new Error('banco fora')
    })

    const res = await request(app)
      .post('/webhooks/resend')
      .set(signedHeaders)
      .set('content-type', 'application/json')
      .send('{}')

    expect(res.status).toBe(500)
  })
})
