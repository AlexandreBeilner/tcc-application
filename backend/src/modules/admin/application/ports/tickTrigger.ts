// Espelha o payload de resposta de POST /admin/tick do motor de simulação
// (tarefa 3.11) — mesmos nomes de campo (snake_case), sem tradução: o
// backend só garante role = admin (RNF07) antes de repassar, mesma
// convenção de MacroEventTrigger. Sem body de request — o motor não aceita
// parâmetro nenhum nesta rota.
export interface TickResult {
  day: number
  selic_rate: number
  quotes_count: number
  fundamentals_count: number
  is_copom_day: boolean
  is_report_day: boolean
  dividends_generated_count: number
  dividends_paid_count: number
  bot_fills_count: number
  expired_orders_count: number
  uncovered_assets_count: number
  intraday_rounds_count: number
}

// Força um tick fora do agendamento diário automático do motor — usado
// tanto pelo painel admin/demo pra banca quanto pra avançar dias simulados
// em suíte de teste ponta a ponta (tarefa 7.3).
export interface TickTrigger {
  run(): Promise<TickResult>
}
