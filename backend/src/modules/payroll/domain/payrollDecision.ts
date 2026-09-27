import { addMonths, monthsBetween } from './monthKey'

const REQUIRED_BUSINESS_DAYS_FOR_CURRENT_MONTH = 5

export interface PayrollDecisionInput {
  currentMonthKey: string
  // `null` = usuário nunca recebeu salário — nunca paga retroativo além do
  // mês corrente nesse caso (decisão de sessão T.5): sem isso, o primeiro
  // check depois do módulo existir pagaria "desde a criação da conta".
  lastPaidMonthKey: string | null
  // Dias úteis já decorridos no mês corrente (T.4 `businessDaysElapsed`,
  // 1º dia do mês até hoje) — >= 5 quer dizer que o mês corrente já venceu,
  // mesmo que hoje não seja exatamente o 5º dia útil (catch-up).
  currentMonthBusinessDaysElapsed: number
  // Teto de meses recuperados de uma vez (mesmo espírito de
  // `TICK_MAX_CATCHUP` do motor, S.3) — o excedente mais antigo é
  // descartado, nunca pago.
  maxCatchUpMonths: number
}

// monthsToPay (tarefa T.5) decide quais meses-calendário (`'YYYY-MM'`,
// ordem cronológica) devem ser creditados agora. Todo mês estritamente
// anterior ao corrente já elapsou por completo — presumido vencido (o 5º dia
// útil dele já passou há muito, não precisa reconsultar o calendário desse
// mês). O mês corrente só entra se `currentMonthBusinessDaysElapsed >= 5`.
export function monthsToPay(input: PayrollDecisionInput): string[] {
  if (input.lastPaidMonthKey === input.currentMonthKey) {
    return []
  }

  const start =
    input.lastPaidMonthKey === null ? input.currentMonthKey : addMonths(input.lastPaidMonthKey, 1)
  const totalCandidateMonths = monthsBetween(start, input.currentMonthKey) + 1

  const months: string[] = []
  for (let i = 0; i < totalCandidateMonths; i++) {
    const monthKey = addMonths(start, i)
    const isCurrentMonth = monthKey === input.currentMonthKey
    if (isCurrentMonth && input.currentMonthBusinessDaysElapsed < REQUIRED_BUSINESS_DAYS_FOR_CURRENT_MONTH) {
      break
    }
    months.push(monthKey)
  }

  if (months.length > input.maxCatchUpMonths) {
    return months.slice(months.length - input.maxCatchUpMonths)
  }
  return months
}
