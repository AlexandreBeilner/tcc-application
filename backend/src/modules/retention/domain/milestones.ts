// Marcos por pessoa do painel de retenção (RT.1.1, RP3): a primeira vez que cada fato aconteceu.
// "Primeiro acesso depois do cadastro" não é marco aqui: sai de `daily_presence` (o primeiro dia de
// presença depois do dia do cadastro), então não precisa de gravação própria.
export const MILESTONES = [
  'first_lesson',
  // Primeira ordem de ação, FII ou ETF do mercado ao vivo com execução, ou compra de renda fixa ao
  // vivo. Sandbox nunca conta (a Fase B do mesmo backlog grava compras de Sandbox no onboarding).
  'first_trade',
  'first_fixed_income',
  'first_daily',
] as const

export type Milestone = (typeof MILESTONES)[number]

export function isMilestone(value: string): value is Milestone {
  return (MILESTONES as readonly string[]).includes(value)
}
