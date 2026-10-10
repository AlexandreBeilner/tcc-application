// Conquista "rara" (EM.7.2, E14): poucas pessoas a têm. Rara = quem a tem é no máximo 10% das
// contas, e só se a base é grande o bastante pra a proporção significar algo: com 12 contas, "1
// de 12" é 8% e não diz nada sobre a conquista. Valores de produto, ainda não confirmados pelo
// autor (ver `pontos-em-aberto-decisao-produto.md`).
export const RARE_MAX_HOLDER_SHARE = 0.1
export const RARE_MIN_POPULATION = 20

export interface AchievementRarity {
  // Contas que têm a conquista, já contando quem acabou de desbloqueá-la.
  holders: number
  // Contas de usuário que contam na comparação (ativas, não anonimizadas).
  population: number
}

export function isRareAchievement(rarity: AchievementRarity): boolean {
  return (
    rarity.population >= RARE_MIN_POPULATION &&
    rarity.holders > 0 &&
    rarity.holders / rarity.population <= RARE_MAX_HOLDER_SHARE
  )
}
