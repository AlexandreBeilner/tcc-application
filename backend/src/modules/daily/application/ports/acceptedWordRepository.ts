export type AcceptedWordSource = 'vero' | 'extra'

export interface AcceptedWordRepository {
  // Palavra já normalizada. Busca por chave, sem carregar a lista.
  isAccepted(word: string): Promise<boolean>
  // Idempotente: o que já existe é ignorado. Devolve quantas entraram.
  // Só a lista extra (a do dicionário não se edita pelo painel).
  listExtra(): Promise<string[]>
  // Nunca remove palavra do dicionário. Devolve se removeu.
  removeExtra(word: string): Promise<boolean>
  addMany(words: readonly string[], source: AcceptedWordSource): Promise<number>
}
