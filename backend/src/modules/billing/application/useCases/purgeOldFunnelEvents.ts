import { FUNNEL_RETENTION_MONTHS } from '../../domain/funnel'
import type { FunnelRetention } from '../ports/funnelRetention'

// Os eventos do funil de conversão ficam `FUNNEL_RETENTION_MONTHS` meses (ponto 048, decisão do
// autor em 2026-10-11) e depois são apagados. Idempotente: repetir só não acha mais nada.
export class PurgeOldFunnelEventsUseCase {
  constructor(
    private readonly retention: FunnelRetention,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(): Promise<number> {
    const cutoff = this.now()
    cutoff.setUTCMonth(cutoff.getUTCMonth() - FUNNEL_RETENTION_MONTHS)
    return this.retention.purgeOlderThan(cutoff)
  }
}
