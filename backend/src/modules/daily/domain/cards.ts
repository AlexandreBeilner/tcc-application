// Os três cartões do Diário (DI16). "Mais ou menos" foi descartado.
export const CARD_TYPES = ['word', 'on_this_day', 'timeline'] as const

export type CardType = (typeof CARD_TYPES)[number]

export const CARDS_PER_GAME = CARD_TYPES.length

export function isCardType(value: unknown): value is CardType {
  return typeof value === 'string' && (CARD_TYPES as readonly string[]).includes(value)
}
