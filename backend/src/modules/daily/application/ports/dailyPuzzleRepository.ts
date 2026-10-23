import type { DailyPuzzle } from '../../domain/content'

export type PuzzleItemKind = 'word' | 'question'

export type PuzzleCardChange =
  { card: 'word'; wordId: string } | { card: 'question'; questionId: string }

export interface DailyPuzzleRepository {
  // Falha se o número ou a data já têm jogo.
  create(puzzle: DailyPuzzle): Promise<void>
  findByNumber(number: number): Promise<DailyPuzzle | null>
  findByDate(gameDate: string): Promise<DailyPuzzle | null>
  // Jogos com data >= `fromDate`, em ordem de data (a agenda e a regra dos 30 dias).
  listFromDate(fromDate: string, limit: number): Promise<DailyPuzzle[]>
  // Jogos que usam o item (palavra ou pergunta), para avisar quando o item é editado ou desativado.
  listUsing(kind: PuzzleItemKind, itemId: string): Promise<DailyPuzzle[]>
  // Troca um cartão do jogo e marca a origem como manual. Não toca `publishedAt`: quem decide se
  // pode é o caso de uso.
  updateCard(number: number, card: PuzzleCardChange): Promise<void>
  // Publica de uma vez todos os ainda não publicados com data a partir de `fromDate`. Devolve os números.
  publishPending(fromDate: string, now: Date): Promise<number[]>
  // Tira do ar os jogos publicados com data a partir de `fromDate` (antes da estreia, o que permite
  // renumerar ao mudar a data). Devolve quantos.
  unpublishFrom(fromDate: string): Promise<number>
  markPublished(number: number, now: Date): Promise<void>
  // Troca, numa transação, TODOS os jogos ainda não publicados pelos informados (a agenda refaz
  // números e descarta datas antes da estreia). Jogo publicado nunca é tocado.
  replaceUnpublished(puzzles: readonly DailyPuzzle[]): Promise<void>
}
