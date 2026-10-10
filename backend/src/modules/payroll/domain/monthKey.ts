// "Mês-calendário real" (Fase T, decisão 5) representado como 'YYYY-MM' —
// nunca o bloco de 30 dias fixos do IPCA (convenção só daquele cálculo).
// Aritmética simples de índice de mês (`ano*12 + (mês-1)`) evita qualquer
// pegadinha de fuso/`Date` do JS — as datas de entrada já vêm como texto
// 'YYYY-MM-DD' do motor (dia simulado mapeado 1:1 a partir de
// `simcalendar.BaseDate`).
export function monthKeyOf(date: string): string {
  return date.slice(0, 7)
}

function monthIndex(monthKey: string): number {
  const [year, month] = monthKey.split('-').map(Number)
  return year * 12 + (month - 1)
}

function monthKeyOfIndex(index: number): string {
  const year = Math.floor(index / 12)
  const month = (index % 12) + 1
  return `${year}-${String(month).padStart(2, '0')}`
}

export function addMonths(monthKey: string, delta: number): string {
  return monthKeyOfIndex(monthIndex(monthKey) + delta)
}

// Diferença em meses entre dois 'YYYY-MM' (positivo quando `to` é depois de
// `from`).
export function monthsBetween(from: string, to: string): number {
  return monthIndex(to) - monthIndex(from)
}
