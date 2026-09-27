import { monthlySalaryForLevel } from '../../domain/salary'
import { monthsToPay } from '../../domain/payrollDecision'
import type { LevelReader } from '../ports/levelReader'
import type { PayrollStateRepository } from '../ports/payrollStateRepository'
import type { SalaryCrediter } from '../ports/salaryCrediter'

export interface CreditMonthlyPayrollForUserInput {
  userId: string
  // Vem do check periódico (RunPayrollCheckUseCase) — uma única leitura de
  // calendário serve todos os usuários do mesmo ciclo, em vez de cada
  // usuário consultar o motor de novo pelo mesmo dado global.
  currentMonthKey: string
  currentMonthBusinessDaysElapsed: number
  maxCatchUpMonths: number
}

export interface CreditMonthlyPayrollForUserResult {
  // Meses efetivamente creditados nesta chamada, ordem cronológica — vazio
  // quando não havia nada a pagar (já pago ou fora do dia).
  monthsPaid: string[]
  amountPerMonth: number
}

// CreditMonthlyPayrollForUserUseCase (T.5) — por usuário: decide quais
// meses estão devidos (domínio puro, `monthsToPay`), calcula o valor pelo
// nível atual (T.3, mesmo valor pra todo mês em atraso de um catch-up — o
// motor não guarda nível histórico) e credita via o motor (T.2), um evento
// por mês. Atualiza `lastPaidMonth` depois de CADA crédito bem-sucedido
// (não só no fim do laço) — se o processo cair no meio de um catch-up de
// vários meses, a próxima execução retoma do último mês que realmente foi
// creditado, nunca paga de novo o que já foi.
export class CreditMonthlyPayrollForUserUseCase {
  constructor(
    private readonly levelReader: LevelReader,
    private readonly payrollStateRepository: PayrollStateRepository,
    private readonly salaryCrediter: SalaryCrediter,
  ) {}

  async execute(input: CreditMonthlyPayrollForUserInput): Promise<CreditMonthlyPayrollForUserResult> {
    const lastPaidMonthKey = await this.payrollStateRepository.getLastPaidMonth(input.userId)
    const months = monthsToPay({
      currentMonthKey: input.currentMonthKey,
      lastPaidMonthKey,
      currentMonthBusinessDaysElapsed: input.currentMonthBusinessDaysElapsed,
      maxCatchUpMonths: input.maxCatchUpMonths,
    })

    if (months.length === 0) {
      return { monthsPaid: [], amountPerMonth: 0 }
    }

    const level = await this.levelReader.getLevel(input.userId)
    const amountPerMonth = monthlySalaryForLevel(level)

    for (const monthKey of months) {
      await this.salaryCrediter.credit(input.userId, amountPerMonth)
      await this.payrollStateRepository.setLastPaidMonth(input.userId, monthKey)
    }

    return { monthsPaid: months, amountPerMonth }
  }
}
