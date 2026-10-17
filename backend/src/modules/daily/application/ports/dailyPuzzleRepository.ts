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
  // Troca, numa transação, TODOS os jogos ainda não publicados pelos informados (a agenda refaz
  // números e descarta datas antes da estreia sem perder a revisão). Jogo publicado nunca é tocado.
  replaceUnpublished(puzzles: readonly DailyPuzzle[]): Promise<void>
}
