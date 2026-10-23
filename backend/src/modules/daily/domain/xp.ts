import { CARDS_PER_GAME } from './cards'

export const XP_FOR_COMPLETING = 20
export const XP_PER_CORRECT_CARD = 15

// DI6 (revisto pela DI18): 20 por concluir mais 15 por cartão certo, de 20 (nenhum) a 50 (os dois).
export function calculateDailyXp(correctCards: number): number {
  if (!Number.isInteger(correctCards) || correctCards < 0 || correctCards > CARDS_PER_GAME) {
    throw new RangeError(`correctCards fora de 0..${CARDS_PER_GAME}: ${correctCards}`)
  }
  return XP_FOR_COMPLETING + XP_PER_CORRECT_CARD * correctCards
}
