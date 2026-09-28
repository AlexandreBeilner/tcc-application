import type { PayrollCalendarReader } from '../ports/payrollCalendarReader'
import type { UserDirectory } from '../ports/userDirectory'
import type { CreditMonthlyPayrollForUserUseCase } from './creditMonthlyPayrollForUser'

export interface RunPayrollCheckResult {
  usersChecked: number
  usersPaid: number
  monthsPaidTotal: number
}

// RunPayrollCheckUseCase (T.5) — o que o job periódico do backend chama a
// cada tick do agendador (`payroll/infrastructure/scheduler`). Lê o
// progresso do mês corrente UMA vez (dado global, mesmo pra todo usuário) e
// delega a decisão por conta a `CreditMonthlyPayrollForUserUseCase`. Uma
// falha isolada num usuário é logada e não interrompe os demais — mesmo
// espírito do Temporizador do motor (S.3), onde uma falha de tick não
// derruba o processo.
export class RunPayrollCheckUseCase {
  constructor(
    private readonly userDirectory: UserDirectory,
    private readonly payrollCalendarReader: PayrollCalendarReader,
    private readonly creditMonthlyPayrollForUser: CreditMonthlyPayrollForUserUseCase,
    private readonly maxCatchUpMonths: number,
  ) {}

  async execute(): Promise<RunPayrollCheckResult> {
    const [userIds, monthProgress] = await Promise.all([
      this.userDirectory.listAllUserIds(),
      this.payrollCalendarReader.getCurrentMonthProgress(),
    ])

    let usersPaid = 0
    let monthsPaidTotal = 0

    for (const userId of userIds) {
      try {
        const result = await this.creditMonthlyPayrollForUser.execute({
          userId,
          currentMonthKey: monthProgress.currentMonthKey,
          currentMonthBusinessDaysElapsed: monthProgress.businessDaysElapsedThisMonth,
          maxCatchUpMonths: this.maxCatchUpMonths,
        })
        if (result.monthsPaid.length > 0) {
          usersPaid++
          monthsPaidTotal += result.monthsPaid.length
        }
      } catch (err) {
        console.error(`folha de pagamento: falha ao creditar salário do usuário ${userId}`, err)
      }
    }

    return { usersChecked: userIds.length, usersPaid, monthsPaidTotal }
  }
}
