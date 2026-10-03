import type { AuditAction, AuditResult } from '../../../services/admin'

// Rótulos dos valores da lista fechada de ações auditáveis do backend. Ação
// nova da Fase N entra aqui junto de `AuditAction` (o `Record` quebra o build
// se faltar uma).
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
    'macro_event.trigger': 'Disparo de evento macro',
    'macro_event.cancel': 'Cancelamento de evento macro',
    'tick.trigger': 'Disparo de tick',
    'tick.advance': 'Avanço de dias do mercado',
    'scheduler.pause': 'Pausa do temporizador',
    'scheduler.resume': 'Retomada do temporizador',
    'order.cancel': 'Cancelamento de ordem',
    'order.cancel_batch': 'Cancelamento de ordens em lote',
    'trading.halt': 'Pausa de negociação',
    'trading.resume': 'Retomada da negociação',
    'bot.create': 'Criação de bot',
    'bot.update': 'Alteração de bot',
    'bot.fund': 'Aporte em bot',
    'settings.update': 'Alteração de parâmetro',
    'settings.reset': 'Restauração de parâmetro',
}

export const AUDIT_RESULT_LABELS: Record<AuditResult, string> = {
    success: 'Sucesso',
    failed: 'Falha',
}
