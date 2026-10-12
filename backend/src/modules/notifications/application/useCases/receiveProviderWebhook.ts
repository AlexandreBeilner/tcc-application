import type { ProviderEvent } from '../../domain/providerEvent'
import type { EmailOutboxRepository } from '../ports/emailOutboxRepository'
import type { EmailSuppressionRepository } from '../ports/emailSuppressionRepository'
import type { WebhookEventParser, WebhookRequest } from '../ports/webhookEventParser'

// Processa um webhook do provedor: verifica a assinatura (via parser), e aplica o efeito.
// Idempotente por natureza (o provedor reenvia até receber 200): marcar entregue e suprimir
// endereço repetidos deixam o mesmo estado, então não precisa de tabela de eventos já vistos.
export class ReceiveProviderWebhookUseCase {
  constructor(
    private readonly parser: WebhookEventParser,
    private readonly outbox: EmailOutboxRepository,
    private readonly suppressions: EmailSuppressionRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(request: WebhookRequest): Promise<ProviderEvent['type']> {
    const event = this.parser.parse(request)
    const at = this.now()

    switch (event.type) {
      case 'delivered':
        await this.outbox.markDelivered(event.providerMessageId, at)
        break
      case 'bounced':
        if (event.permanent) {
          for (const address of event.recipients) {
            await this.suppressions.add(address.trim().toLowerCase(), 'bounce', at)
          }
        }
        break
      case 'complained':
        for (const address of event.recipients) {
          await this.suppressions.add(address.trim().toLowerCase(), 'complaint', at)
        }
        break
      case 'ignored':
        break
    }
    return event.type
  }
}
