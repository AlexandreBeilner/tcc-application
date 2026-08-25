import type { ProgressSnapshot } from '../../domain/achievement'

// Port única que agrega os 4 números (streak/lições/patrimônio/operações) —
// a composição (app.ts) injeta um adapter que, por baixo, faz 3 chamadas em
// processo (gamification/lessons/ranking); nenhum dos casos de uso deste
// módulo precisa saber disso.
export interface ProgressSnapshotReader {
  getSnapshot(userId: string): Promise<ProgressSnapshot>
}
