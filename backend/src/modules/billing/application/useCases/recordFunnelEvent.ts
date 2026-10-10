import { clientEventKey } from '../../domain/funnel'
import type { ClientFunnelEvent, FunnelSource } from '../../domain/funnel'
import type { SubscriptionPeriod } from '../../domain/subscription'
import type { FunnelRecorder } from '../ports/funnelRecorder'

// Evento do funil reportado pelo cliente (viu convite, abriu /planos, iniciou compra). Nunca
// carrega valor nem dado de cartão. Não importa se a pessoa já é PRO: o painel só conta o que
// aconteceu, e o convite some pra quem é PRO no próprio frontend.
export class RecordFunnelEventUseCase {
  constructor(
    private readonly recorder: FunnelRecorder,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(
    userId: string,
    input: { event: ClientFunnelEvent; source?: FunnelSource; plan?: SubscriptionPeriod },
  ): Promise<void> {
    const at = this.now()
    const source = input.source ?? null
    await this.recorder.record({
      userId,
      name: input.event,
      source,
      plan: input.plan ?? null,
      dedupeKey: clientEventKey(userId, input.event, source, at),
      at,
    })
  }
}
