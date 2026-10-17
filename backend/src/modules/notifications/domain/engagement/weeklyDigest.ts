import { brasiliaParts, shiftDate } from './brasiliaTime'

// O resumo semanal sai na segunda-feira, a partir das 9h de Brasília, e a janela fecha às 21h:
// quem passa a receber (liga a opção) na segunda à tarde ainda recebe o da semana, mas ninguém
// recebe de madrugada nem na terça.
export const DIGEST_WEEKDAY = 1
export const DIGEST_FIRST_HOUR = 9
export const DIGEST_LAST_HOUR = 20

export function isWeeklyDigestDue(now: Date): boolean {
  const { weekday, hour } = brasiliaParts(now)
  return weekday === DIGEST_WEEKDAY && hour >= DIGEST_FIRST_HOUR && hour <= DIGEST_LAST_HOUR
}

// A semana é identificada pela segunda-feira de Brasília: é a base da chave de idempotência
// (`weekly-digest:<usuário>:<segunda>`), então o mesmo usuário nunca recebe dois na mesma semana.
export function digestWeekKey(now: Date): string {
  const { date, weekday } = brasiliaParts(now)
  return shiftDate(date, -((weekday + 6) % 7))
}

// Os 7 dias (UTC, o dia do Diário) da semana que acabou: da segunda anterior ao domingo de ontem.
// O resumo sai na segunda entre 9h e 20h de Brasília (12h a 23h UTC), então o dia de Brasília e o
// de UTC coincidem e `digestWeekKey` é também a segunda em UTC.
export function digestPlayedWindow(now: Date): { from: string; to: string } {
  const monday = digestWeekKey(now)
  return { from: shiftDate(monday, -7), to: shiftDate(monday, -1) }
}
