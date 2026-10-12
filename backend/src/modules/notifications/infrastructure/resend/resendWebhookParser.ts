import { Resend } from 'resend'
import type { WebhookEventParser } from '../../application/ports/webhookEventParser'
import { InvalidWebhookSignatureError } from '../../domain/errors'
import type { ProviderEvent } from '../../domain/providerEvent'

// Recorte do SDK que o adapter usa (o teste o substitui). `verify` confere a assinatura Svix
// (`svix-id`, `svix-timestamp`, `svix-signature`) e a tolerância de timestamp, e lança se falhar.
export interface ResendWebhooks {
  verify(options: {
    payload: string
    headers: { id: string; timestamp: string; signature: string }
    webhookSecret: string
  }): unknown
}

export function createResendWebhooks(apiKey: string): ResendWebhooks {
  return new Resend(apiKey).webhooks as unknown as ResendWebhooks
}

interface ResendEventShape {
  type?: unknown
  data?: {
    email_id?: unknown
    to?: unknown
    bounce?: { type?: unknown }
  }
}

export function createResendWebhookParser(options: {
  webhooks: ResendWebhooks
  webhookSecret: string
}): WebhookEventParser {
  return {
    parse(request) {
      let verified: unknown
      try {
        verified = options.webhooks.verify({
          payload: request.rawBody,
          headers: request.headers,
          webhookSecret: options.webhookSecret,
        })
      } catch {
        throw new InvalidWebhookSignatureError()
      }
      return toProviderEvent(verified as ResendEventShape)
    },
  }
}

function toProviderEvent(event: ResendEventShape): ProviderEvent {
  const providerMessageId = event.data?.email_id
  if (typeof providerMessageId !== 'string') return { type: 'ignored' }
  const recipients = Array.isArray(event.data?.to)
    ? event.data.to.filter((to): to is string => typeof to === 'string')
    : []

  switch (event.type) {
    case 'email.delivered':
      return { type: 'delivered', providerMessageId }
    case 'email.bounced': {
      const bounceType = event.data?.bounce?.type
      return {
        type: 'bounced',
        providerMessageId,
        recipients,
        permanent: typeof bounceType === 'string' && bounceType.toLowerCase() === 'permanent',
      }
    }
    case 'email.complained':
      return { type: 'complained', providerMessageId, recipients }
    default:
      return { type: 'ignored' }
  }
}
