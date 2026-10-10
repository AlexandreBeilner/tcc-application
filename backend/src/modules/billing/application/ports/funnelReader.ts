import type { FunnelSummary } from '../../domain/funnel'

// Resumo do funil na janela [since, now]: pessoas distintas por passo e por ponto de convite.
export interface FunnelReader {
  summarize(since: Date): Promise<FunnelSummary>
}
