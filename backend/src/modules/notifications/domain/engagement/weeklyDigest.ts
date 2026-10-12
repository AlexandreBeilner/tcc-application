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
