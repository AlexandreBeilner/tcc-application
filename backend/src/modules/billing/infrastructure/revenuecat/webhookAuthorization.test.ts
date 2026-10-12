import { describe, expect, it } from 'vitest'
import { createWebhookAuthorizer } from './webhookAuthorization'

describe('createWebhookAuthorizer', () => {
  const isAuthorized = createWebhookAuthorizer('Bearer segredo-do-webhook')

  it('aceita o valor exato', () => {
    expect(isAuthorized('Bearer segredo-do-webhook')).toBe(true)
  })

  it.each([
    ['ausente', undefined],
    ['vazio', ''],
    ['outro valor', 'Bearer outro'],
    ['prefixo do certo', 'Bearer segredo'],
    ['maiúsculas diferentes', 'bearer SEGREDO-DO-WEBHOOK'],
  ])('recusa: %s', (_label, header) => {
    expect(isAuthorized(header)).toBe(false)
  })
})
