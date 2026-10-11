import type { Assembly, HoldingsSnapshot } from '../../domain/assembly'

// Posições na data de corte da assembleia. Hoje vem do motor (que é dono das posições); o adapter
// entra na MO.6.3. Nenhum SQL do mercado no Node.
export interface HoldingsSnapshotProvider {
  get(assembly: Assembly): Promise<HoldingsSnapshot>
}
