import type { Snapshot } from '../../domain/networth'

// Lê o patrimônio "agora" a partir do estado já projetado (conta, posições)
// em vez de reconstruir por replay — mais barato pro lado que não precisa
// de histórico. `tradesExecuted` não é computado neste caminho rápido (ver
// nota em `getNetWorth.ts`).
export interface CurrentSnapshotOptions {
  // Avalia a renda fixa pelo valor de hoje (líquido de IR, mesma conta do resgate) em vez do custo.
  // Só o ranking usa; patrimônio de conquistas, perfil e painel seguem a custo.
  valuedFixedIncome?: boolean
}

export interface CurrentAccountStateReader {
  getCurrentSnapshot(userId: string, options?: CurrentSnapshotOptions): Promise<Snapshot>
}
