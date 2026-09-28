// Port sobre o motor de simulação (T.2, `POST /accounts/{user_id}/salary`) —
// crédito de caixa livre, nunca toca `total_invested`/`total_disinvested`
// (T.1). Um crédito por chamada (evento imutável próprio no motor); um
// catch-up de vários meses (T.5) chama isto uma vez por mês devido, com o
// `referenceMonth` ('YYYY-MM') daquele mês específico — achado 025: sem ele,
// vários créditos do mesmo catch-up caem no mesmo dia simulado (o dia em que
// o job rodou, não o 5º dia útil real de cada mês) e ficam indistinguíveis.
export interface SalaryCrediter {
  credit(userId: string, amount: number, referenceMonth: string): Promise<void>
}
