import { daysBetween } from './gameDay'

// DI11: a estreia só pode ser agendada com pelo menos 30 dias de jogos
// revisados à frente.
export const MIN_CONTENT_DAYS_AHEAD = 30

export type StartDateChangeError = 'already_started' | 'not_in_future' | 'insufficient_content'

export interface StartDateChange {
  current: string | null
  next: string | null
  today: string
  // Dias consecutivos de jogo materializado e revisado a partir de `next`.
  reviewedDaysFromNext: number
}

// Seção 3.5: a data muda livre enquanto futura; depois que o jogo está no
// ar ela trava (mudar renumeraria jogos já jogados e compartilhados).
// Desligar (`next` null) conta como mudança: só enquanto ainda não começou.
// Agendar exige data estritamente futura: começar "hoje" não é agendar.
export function validateStartDateChange(change: StartDateChange): StartDateChangeError | null {
  const { current, next, today, reviewedDaysFromNext } = change
  if (current !== null && current <= today) return 'already_started'
  if (next === null) return null
  if (daysBetween(today, next) < 1) return 'not_in_future'
  if (reviewedDaysFromNext < MIN_CONTENT_DAYS_AHEAD) return 'insufficient_content'
  return null
}
