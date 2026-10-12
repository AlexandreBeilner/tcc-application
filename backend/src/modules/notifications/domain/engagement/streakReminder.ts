import { brasiliaParts, shiftDate } from './brasiliaTime'

// O dia da sequência (streak) é o dia em UTC (`gamification/domain/streak.ts`), que termina às
// 21h de Brasília. O lembrete sai à tarde, entre 17h e 19h59 de Brasília: ainda sobra tempo pra
// uma lição rápida e nunca chega perto da virada nem de madrugada.
export const STREAK_REMINDER_FIRST_HOUR = 17
export const STREAK_REMINDER_LAST_HOUR = 19

// Sequência de 1 ou 2 dias ainda não é "algo a manter": o lembrete só vale a partir daqui.
// Valor de produto ainda não confirmado pelo autor (ver `pontos-em-aberto-decisao-produto.md`).
export const MIN_STREAK_FOR_REMINDER = 3

export function isStreakReminderDue(now: Date): boolean {
  const { hour } = brasiliaParts(now)
  return hour >= STREAK_REMINDER_FIRST_HOUR && hour <= STREAK_REMINDER_LAST_HOUR
}

// Nessa janela (17h a 19h59 de Brasília = 20h a 22h59 UTC) o dia de Brasília e o de UTC são o
// mesmo, então um único dia serve de chave de idempotência e de referência do streak.
export function streakReminderDay(now: Date): string {
  return brasiliaParts(now).date
}

// Quem tem a sequência "de pé" e ainda não cumpriu o dia: a última atividade foi ontem. Quem já
// fez a atividade de hoje não precisa de lembrete, e quem não fez ontem já perdeu a sequência
// (lembrar agora seria cobrar algo que já passou).
export function lastActivityDayForReminder(now: Date): string {
  return shiftDate(streakReminderDay(now), -1)
}
