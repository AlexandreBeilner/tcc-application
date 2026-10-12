// Rentabilidade percentual de uma pessoa entre dois instantes (módulo `ranking`). Só percentual.
export interface MonthReturnReader {
  returnPct(userId: string, from: Date, to: Date): Promise<number>
}
