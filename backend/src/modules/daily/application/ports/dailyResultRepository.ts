import type { DailyResult } from '../../domain/content'

export interface DailyResultRepository {
  find(userId: string, puzzleNumber: number): Promise<DailyResult | null>
  // Cria ou substitui a única linha de (usuário, jogo).
  save(result: DailyResult): Promise<void>
  listByUser(userId: string): Promise<DailyResult[]>
}
