import type {
  CurrentMonthProgress,
  PayrollCalendarReader,
} from '../../application/ports/payrollCalendarReader'

export function createFakePayrollCalendarReader(
  progress: CurrentMonthProgress,
): PayrollCalendarReader {
  return {
    async getCurrentMonthProgress() {
      return progress
    },
  }
}
