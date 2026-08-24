export interface Progression {
  userId: string
  xp: number
  level: number
}

// Curva ilustrativa, sujeita à calibração da tarefa 8.1 (mesmo tratamento
// dado às constantes do motor) — crescimento quadrático simples: nível 2 aos
// 100xp, nível 3 aos 300xp, nível 4 aos 600xp, etc.
// xpRequiredForLevel(L) = 100 * (L-1) * L / 2 (números triangulares * 100).
function xpRequiredForLevel(level: number): number {
  return (100 * (level - 1) * level) / 2
}

export function levelForXp(xp: number): number {
  let level = 1
  while (xpRequiredForLevel(level + 1) <= xp) {
    level++
  }
  return level
}
