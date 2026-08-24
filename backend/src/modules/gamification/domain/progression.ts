// Uma linha de `user_progression` por usuário — XP/nível (5.1) e streak
// (5.3) vivem na mesma entidade porque vivem na mesma tabela; cada caso de
// uso só lê-modifica-escreve os campos que é dono, preservando os outros.
export interface Progression {
  userId: string
  xp: number
  level: number
  currentStreak: number
  longestStreak: number
  // Dia calendário em UTC, formato YYYY-MM-DD — ver domain/streak.ts.
  lastQualifyingActivityDate: string | null
}

export function defaultProgression(userId: string): Progression {
  return {
    userId,
    xp: 0,
    level: 1,
    currentStreak: 0,
    longestStreak: 0,
    lastQualifyingActivityDate: null,
  }
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
