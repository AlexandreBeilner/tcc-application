// Port sobre o motor de simulação (T.2, `POST /accounts/{user_id}/salary`) —
// crédito de caixa livre, nunca toca `total_invested`/`total_disinvested`
// (T.1). Um crédito por chamada (evento imutável próprio no motor); um
// catch-up de vários meses (T.5) chama isto uma vez por mês devido.
export interface SalaryCrediter {
  credit(userId: string, amount: number): Promise<void>
}
