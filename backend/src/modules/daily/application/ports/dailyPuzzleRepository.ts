import type { DailyPuzzle } from '../../domain/content'

export interface DailyPuzzleRepository {
  // Falha se o número ou a data já têm jogo.
  create(puzzle: DailyPuzzle): Promise<void>
  findByNumber(number: number): Promise<DailyPuzzle | null>
  findByDate(gameDate: string): Promise<DailyPuzzle | null>
  // Jogos com data >= `fromDate`, em ordem de data (a agenda e a regra dos 30 dias).
  listFromDate(fromDate: string, limit: number): Promise<DailyPuzzle[]>
  markReviewed(number: number, reviewedBy: string, now: Date): Promise<void>
  markPublished(number: number, now: Date): Promise<void>
  // Só jogos ainda não publicados (a agenda refaz a partir da nova estreia). Devolve quantos saíram.
  deleteUnpublishedFromDate(fromDate: string): Promise<number>
}
