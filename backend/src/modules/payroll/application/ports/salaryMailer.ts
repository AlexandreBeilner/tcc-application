// Aviso por e-mail do salário simulado creditado (EM.7.2, E11). Port própria do módulo,
// implementada na composição por um adapter sobre `modules/notifications`: opt-in de engajamento
// e idempotência por mês são decisão do adapter e do módulo de e-mail, não do caso de uso.
export interface SalaryMailer {
  // `monthKeys`: meses ('YYYY-MM') creditados nesta rodada, em ordem (mais de um num catch-up
  // depois de o backend ter ficado fora do ar). Vira um e-mail só.
  sendSalaryCredited(input: {
    userId: string
    monthKeys: string[]
    amountPerMonth: number
  }): Promise<void>
}
