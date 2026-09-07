export interface StreakState {
  currentStreak: number
  longestStreak: number
  // Dia calendário em UTC, formato YYYY-MM-DD (mesmo formato do tipo `date`
  // do Postgres) — timezone fixado em UTC (decisão desta sessão, não
  // confirmada explicitamente com o usuário — sinalizar se divergir): evita
  // depender de fuso do usuário, inexistente no modelo hoje.
  lastQualifyingActivityDate: string | null
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / MS_PER_DAY)
}

// Pura, idempotente: chamar de novo no mesmo dia não altera o estado (não
// infla o contador); dia seguinte consecutivo soma 1; gap >= 2 dias sem
// atividade reseta pra 1 (o próprio dia de hoje já conta); `longestStreak` é
// o máximo histórico, nunca decresce.
export function touch(current: StreakState, today: string): StreakState {
  if (current.lastQualifyingActivityDate === today) {
    return current
  }

  const isConsecutiveDay =
    current.lastQualifyingActivityDate !== null &&
    daysBetween(current.lastQualifyingActivityDate, today) === 1

  const currentStreak = isConsecutiveDay ? current.currentStreak + 1 : 1
  const longestStreak = Math.max(current.longestStreak, currentStreak)

  return { currentStreak, longestStreak, lastQualifyingActivityDate: today }
}

export function todayUtc(now: Date): string {
  return now.toISOString().slice(0, 10)
}

// Marcos reais de `criteriaType: 'streak_days'` em `seedAchievements.ts` —
// 7 (Primeira Semana) e 30 (Fiel). Não deriva do catálogo de conquistas em
// runtime (acoplaria `domain/` a outro módulo só pra isso); se um marco
// novo for seedado, este array precisa acompanhar manualmente.
const STREAK_MILESTONES = [7, 30]

// Pura: compara o streak antes/depois de um `touch()` e diz qual marco foi
// cruzado nesta chamada, se algum — nunca reporta um marco já ultrapassado
// em chamadas anteriores (`before < marco`), nem quando `touch()` foi
// idempotente no mesmo dia (`before === after`, nenhum marco satisfaz
// `before < marco` e `after >= marco` ao mesmo tempo pra esse caso).
export function streakMilestoneReached(before: number, after: number): number | null {
  return STREAK_MILESTONES.find((milestone) => before < milestone && after >= milestone) ?? null
}
