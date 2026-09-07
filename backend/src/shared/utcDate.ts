// Dia calendário em UTC, formato YYYY-MM-DD — usado por `gamification`
// (streak), `missions` (missão diária) e `lessons` (revisão de lição
// antiga) pra decidir o corte de "dia" das respectivas regras. Extraído
// pra cá porque as três reimplementavam a mesma linha e já se apontavam
// umas às outras nos comentários (revisão da PR 17) — mesmo precedente de
// `shared/pagination.ts`/`shared/avatarUrl.ts`: função pura, sem I/O, sem
// regra de negócio própria. Sem conceito de fuso do usuário no modelo hoje.
export function utcDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}
