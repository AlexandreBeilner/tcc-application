// Port própria sobre `modules/market` (relógio + calendário do mercado
// simulado, S.10) — implementada, na composição, por um adapter em
// processo que chama `GetMarketClockUseCase`/`GetMarketCalendarUseCase` e já
// devolve o resultado pronto pro domínio (`businessDaysElapsed`, T.4), sem
// nenhum caso de uso de payroll precisar conhecer o payload cru do motor.
export interface CurrentMonthProgress {
  // 'YYYY-MM', mês-calendário real de hoje (nunca o bloco de 30 dias do
  // IPCA) — mesma convenção de `payroll/domain/monthKey.ts`.
  currentMonthKey: string
  // Dias úteis decorridos do 1º dia desse mês até hoje, inclusive —
  // `payroll/domain/businessDay.ts` `businessDaysElapsed`.
  businessDaysElapsedThisMonth: number
}

export interface PayrollCalendarReader {
  getCurrentMonthProgress(): Promise<CurrentMonthProgress>
}
