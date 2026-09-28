// Port própria e mínima sobre `modules/payroll` (T.8) — implementada, na
// composição (app.ts), por um adapter em processo sobre a função pura
// `monthlySalaryForLevel` (T.3). Direção inversa dos outros 4 precedentes de
// port cruzada do backend (ranking/auth/payroll importam gamification): aqui
// é gamification quem consome payroll, só pra `GET /*/progression` expor o
// salário como informação derivada do nível, sem duplicar a fórmula em
// degraus. Síncrona (não `Promise`) porque a fórmula é pura, sem I/O.
export interface MonthlySalaryReader {
  getMonthlySalaryForLevel(level: number): number
}
