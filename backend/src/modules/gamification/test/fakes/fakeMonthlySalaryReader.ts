import type { MonthlySalaryReader } from '../../application/ports/monthlySalaryReader'

// Fake fixo (não recalcula a fórmula de T.3, evita duplicá-la num arquivo de
// teste): devolve `level * 100` — suficiente pra provar que o router lê o
// nível certo e injeta o valor da porta na resposta, sem acoplar o teste do
// router à fórmula em degraus (isso já é responsabilidade do teste de
// `payroll/domain/salary.test.ts` e de `inProcessMonthlySalaryReader.test.ts`).
export function createFakeMonthlySalaryReader(): MonthlySalaryReader {
  return {
    getMonthlySalaryForLevel: (level) => level * 100,
  }
}
