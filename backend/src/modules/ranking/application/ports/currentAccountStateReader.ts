import type { Snapshot } from '../../domain/networth'

// Lê o patrimônio "agora" a partir do estado já projetado (conta, posições)
// em vez de reconstruir por replay — mais barato pro lado que não precisa
// de histórico. `tradesExecuted` não é computado neste caminho rápido (ver
// nota em `getNetWorth.ts`).
export interface CurrentAccountStateReader {
  getCurrentSnapshot(userId: string): Promise<Snapshot>
}
