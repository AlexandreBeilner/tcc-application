import type { SalaryCrediter } from '../../application/ports/salaryCrediter'

export interface RecordedCredit {
  userId: string
  amount: number
  referenceMonth: string
}

export function createFakeSalaryCrediter(): SalaryCrediter & { credits: RecordedCredit[] } {
  const credits: RecordedCredit[] = []
  return {
    credits,
    async credit(userId, amount, referenceMonth) {
      credits.push({ userId, amount, referenceMonth })
    },
  }
}
