import type { DailyResult } from '../../domain/content'

export interface DailyResultRepository {
  find(userId: string, puzzleNumber: number): Promise<DailyResult | null>
  // Cria ou substitui a única linha de (usuário, jogo).
  save(result: DailyResult): Promise<void>
  listByUser(userId: string): Promise<DailyResult[]>
  // Leitura, alteração e gravação do jogo de um usuário numa operação só, com a linha travada:
  // duas abas jogando ao mesmo tempo se enfileiram, então um cartão nunca é gravado duas vezes e
  // só uma chamada vê o jogo fechar (é ela que concede XP). Cria a linha se ainda não existe. Se
  // `apply` lançar, nada é gravado (nem a linha nova). `apply` é puro e síncrono, sem I/O.
  update<T>(
    userId: string,
    puzzleNumber: number,
    now: Date,
    apply: (current: DailyResult) => { next: DailyResult; value: T },
  ): Promise<{ result: DailyResult; value: T }>
}
