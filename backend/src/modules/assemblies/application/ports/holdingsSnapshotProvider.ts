import type { Assembly, HoldingsSnapshot } from '../../domain/assembly'

// Posições na data de corte da assembleia. Vem do motor (que é dono das posições); nenhum SQL do
// mercado no Node.
export interface HoldingsSnapshotProvider {
  // Tira o snapshot agora (a abertura). Idempotente pela assembleia: repetir devolve a mesma foto.
  take(assembly: Assembly): Promise<HoldingsSnapshot>
  // Lê o snapshot já tirado (apuração, placar).
  get(assembly: Assembly): Promise<HoldingsSnapshot>
}
