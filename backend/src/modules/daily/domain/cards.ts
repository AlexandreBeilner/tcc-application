// Os dois cartões do Diário (DI18). A Linha do tempo saiu e nenhum terceiro cartão entrou;
// "Mais ou menos" já tinha sido descartado (DI16).
export const CARD_TYPES = ['word', 'trivia'] as const

export type CardType = (typeof CARD_TYPES)[number]

export const CARDS_PER_GAME = CARD_TYPES.length

export function isCardType(value: unknown): value is CardType {
  return typeof value === 'string' && (CARD_TYPES as readonly string[]).includes(value)
}
