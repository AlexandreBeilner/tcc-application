import type { ProviderEvent } from '../../domain/providerEvent'

export interface WebhookRequest {
  // Corpo exatamente como chegou (a assinatura cobre os bytes, não o JSON reserializado).
  rawBody: string
  headers: { id: string; timestamp: string; signature: string }
}

// Verifica a assinatura e traduz o evento do provedor. Lança `InvalidWebhookSignatureError`
// se a assinatura não confere, e devolve `{ type: 'ignored' }` pra evento que não interessa.
export interface WebhookEventParser {
  parse(request: WebhookRequest): ProviderEvent
}
