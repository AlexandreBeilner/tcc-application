import { monthlySalaryForLevel } from '../../../payroll/domain/salary'
import type { MonthlySalaryReader } from '../../application/ports/monthlySalaryReader'

export function createInProcessMonthlySalaryReader(): MonthlySalaryReader {
  return {
    getMonthlySalaryForLevel: (level) => monthlySalaryForLevel(level),
  }
}
