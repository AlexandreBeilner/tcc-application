// Ações administrativas auditáveis (Fase N, tarefa N.4). Lista fechada em
// código, não enum do Postgres: a coluna é texto, então uma ação nova das
// tarefas seguintes (`bot.create`, `user.suspend`...) entra aqui sem
// migration — o que não pode acontecer é gravar uma ação fora desta lista.
export const ADMIN_AUDIT_ACTIONS = [
  'macro_event.trigger',
  'tick.trigger',
  'tick.advance',
  'scheduler.pause',
  'scheduler.resume',
  'order.cancel',
  'order.cancel_batch',
  'trading.halt',
  'trading.resume',
  'bot.create',
  'bot.update',
  'bot.fund',
  'settings.update',
  'settings.reset',
] as const

export type AdminAuditAction = (typeof ADMIN_AUDIT_ACTIONS)[number]

export type AdminAuditResult = 'success' | 'failed'

export interface AdminAuditEntry {
  id: string
  adminId: string
  // Preenchido por join com `users`; ausente só se o usuário sumisse (não
  // acontece: a conta é anonimizada, nunca apagada).
  adminUsername?: string
  action: AdminAuditAction
  targetType: string
  targetId?: string
  // Entrada da ação já sem dado sensível (senha, token, patrimônio absoluto).
  payload: Record<string, unknown>
  result: AdminAuditResult
  errorMessage?: string
  occurredAt: Date
}
