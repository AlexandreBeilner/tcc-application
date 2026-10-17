import { CARDS_PER_GAME } from './cards'

export const XP_FOR_COMPLETING = 20
export const XP_PER_CORRECT_CARD = 10

// DI6: 20 por concluir mais 10 por cartão certo, de 20 (nenhum) a 50 (os três).
export function calculateDailyXp(correctCards: number): number {
  if (!Number.isInteger(correctCards) || correctCards < 0 || correctCards > CARDS_PER_GAME) {
    throw new RangeError(`correctCards fora de 0..${CARDS_PER_GAME}: ${correctCards}`)
  }
  return XP_FOR_COMPLETING + XP_PER_CORRECT_CARD * correctCards
}
