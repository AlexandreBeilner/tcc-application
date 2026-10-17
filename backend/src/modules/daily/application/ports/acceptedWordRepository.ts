export type AcceptedWordSource = 'vero' | 'extra'

export interface AcceptedWordRepository {
  // Palavra já normalizada. Busca por chave, sem carregar a lista.
  isAccepted(word: string): Promise<boolean>
  // Idempotente: o que já existe é ignorado. Devolve quantas entraram.
  addMany(words: readonly string[], source: AcceptedWordSource): Promise<number>
}
