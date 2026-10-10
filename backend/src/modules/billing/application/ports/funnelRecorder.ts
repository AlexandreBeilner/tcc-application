import type { FunnelEvent } from '../../domain/funnel'

// Grava um evento do funil. Idempotente por `dedupeKey`: repetir a mesma chave não grava de novo
// nem falha. Quem chama nunca precisa saber se o evento já existia.
export interface FunnelRecorder {
  record(event: FunnelEvent): Promise<void>
}
