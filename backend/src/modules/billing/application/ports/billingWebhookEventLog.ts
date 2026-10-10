export interface BillingWebhookEventLog {
  wasProcessed(eventId: string): Promise<boolean>
  // Idempotente: registrar o mesmo id duas vezes não falha.
  record(eventId: string, eventType: string, at: Date): Promise<void>
}
