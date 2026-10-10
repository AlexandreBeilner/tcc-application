import { describe, expect, it } from 'vitest'
import { Resend } from 'resend'
import { createHmac } from 'node:crypto'
import { InvalidWebhookSignatureError } from '../../domain/errors'
import { createResendWebhookParser, type ResendWebhooks } from './resendWebhookParser'

const headers = { id: 'msg_1', timestamp: '1', signature: 'v1,x' }

function parserFor(verified: unknown) {
  const webhooks: ResendWebhooks = { verify: () => verified }
  return createResendWebhookParser({ webhooks, webhookSecret: 'whsec_x' })
}

const base = { email_id: 'em_1', to: ['ana@exemplo.com'] }

describe('createResendWebhookParser (tradução)', () => {
  it('assinatura rejeitada pelo SDK vira InvalidWebhookSignatureError', () => {
    const parser = createResendWebhookParser({
      webhooks: {
        verify() {
          throw new Error('Message timestamp too old')
        },
      },
      webhookSecret: 'whsec_x',
    })

    expect(() => parser.parse({ rawBody: '{}', headers })).toThrow(InvalidWebhookSignatureError)
  })

  it('email.delivered', () => {
    expect(
      parserFor({ type: 'email.delivered', data: base }).parse({ rawBody: '{}', headers }),
    ).toEqual({ type: 'delivered', providerMessageId: 'em_1' })
  })

  it.each([
    ['Permanent', true],
    ['permanent', true],
    ['Transient', false],
    ['Undetermined', false],
  ])('email.bounced tipo %s => permanente=%s', (type, permanent) => {
    expect(
      parserFor({ type: 'email.bounced', data: { ...base, bounce: { type } } }).parse({
        rawBody: '{}',
        headers,
      }),
    ).toEqual({
      type: 'bounced',
      providerMessageId: 'em_1',
      recipients: ['ana@exemplo.com'],
      permanent,
    })
  })

  it('email.complained', () => {
    expect(
      parserFor({ type: 'email.complained', data: base }).parse({ rawBody: '{}', headers }),
    ).toEqual({ type: 'complained', providerMessageId: 'em_1', recipients: ['ana@exemplo.com'] })
  })

  it.each([
    { type: 'email.opened', data: base },
    { type: 'email.delivery_delayed', data: base },
    { type: 'email.delivered', data: {} },
    {},
  ])('evento que não interessa ou malformado é ignorado: %j', (event) => {
    expect(parserFor(event).parse({ rawBody: '{}', headers })).toEqual({ type: 'ignored' })
  })
})

// Contra o SDK de verdade: assina um corpo do jeito do Svix e confere que a verificação real
// aceita, e rejeita corpo adulterado e segredo errado.
describe('createResendWebhookParser (assinatura real do SDK)', () => {
  const secretBytes = Buffer.from('segredo-de-teste-123456')
  const webhookSecret = `whsec_${secretBytes.toString('base64')}`
  const rawBody = JSON.stringify({ type: 'email.delivered', data: base })

  function signed(body: string, id = 'msg_1', timestamp = String(Math.floor(Date.now() / 1000))) {
    const signature = createHmac('sha256', secretBytes)
      .update(`${id}.${timestamp}.${body}`)
      .digest('base64')
    return { id, timestamp, signature: `v1,${signature}` }
  }

  const parser = createResendWebhookParser({
    webhooks: new Resend('re_test').webhooks as unknown as ResendWebhooks,
    webhookSecret,
  })

  it('aceita assinatura válida', () => {
    expect(parser.parse({ rawBody, headers: signed(rawBody) })).toEqual({
      type: 'delivered',
      providerMessageId: 'em_1',
    })
  })

  it('rejeita corpo adulterado, segredo errado e timestamp velho', () => {
    expect(() =>
      parser.parse({ rawBody: rawBody.replace('em_1', 'em_2'), headers: signed(rawBody) }),
    ).toThrow(InvalidWebhookSignatureError)

    const wrongSecret = createResendWebhookParser({
      webhooks: new Resend('re_test').webhooks as unknown as ResendWebhooks,
      webhookSecret: `whsec_${Buffer.from('outro-segredo').toString('base64')}`,
    })
    expect(() => wrongSecret.parse({ rawBody, headers: signed(rawBody) })).toThrow(
      InvalidWebhookSignatureError,
    )

    const old = String(Math.floor(Date.now() / 1000) - 3600)
    expect(() => parser.parse({ rawBody, headers: signed(rawBody, 'msg_1', old) })).toThrow(
      InvalidWebhookSignatureError,
    )
  })
})
