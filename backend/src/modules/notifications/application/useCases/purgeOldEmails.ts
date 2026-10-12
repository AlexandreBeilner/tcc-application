import type { EmailOutboxRepository } from '../ports/emailOutboxRepository'

// Linhas fechadas há mais que isso perdem endereço e payload (plano 4.3).
export const OUTBOX_RETENTION_DAYS = 30

const DAY_MS = 24 * 60 * 60_000

// Retenção do outbox (EM.8.1, LGPD): o endereço de entrega e o conteúdo do e-mail são dado
// pessoal que não precisa ficar depois que o e-mail saiu ou desistiu de sair. Roda pelo mesmo
// processo do worker, em cadência bem mais lenta (ver o scheduler).
export class PurgeOldEmailsUseCase {
  constructor(
    private readonly outbox: EmailOutboxRepository,
    private readonly retentionDays: number = OUTBOX_RETENTION_DAYS,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(): Promise<{ scrubbed: number }> {
    const cutoff = new Date(this.now().getTime() - this.retentionDays * DAY_MS)
    return { scrubbed: await this.outbox.scrubClosedBefore(cutoff) }
  }
}
