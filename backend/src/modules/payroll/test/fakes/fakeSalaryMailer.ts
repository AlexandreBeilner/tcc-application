import type { SalaryMailer } from '../../application/ports/salaryMailer'

export interface RecordedSalaryMail {
  userId: string
  monthKeys: string[]
  amountPerMonth: number
}

export function createFakeSalaryMailer(): SalaryMailer & { sent: RecordedSalaryMail[] } {
  const sent: RecordedSalaryMail[] = []
  return {
    sent,
    async sendSalaryCredited(input) {
      sent.push(input)
    },
  }
}
