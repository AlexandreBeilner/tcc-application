// Crédito de caixa na conta de um usuário (N.17). O motor valida o valor, grava o evento
// imutável `admin_credit` antes de projetar o saldo e devolve o valor de fato creditado
// (arredondado a centavos). Não há motivo aqui: ele fica no log de auditoria.
export interface UserCashCreditor {
  credit(userId: string, amount: number): Promise<{ credited: number }>
}
