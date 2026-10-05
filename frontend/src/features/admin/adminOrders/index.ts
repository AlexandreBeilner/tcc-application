import { ApiError } from '../../../services/client'
import type { AdminOrder, AdminOrderStatus } from '../../../services/admin'
import { describeArchetype } from '../botLabels'

export const STATUS_LABELS: Record<AdminOrderStatus, string> = {
    pending: 'Aberta',
    partially_filled: 'Parcial',
    filled: 'Executada',
    cancelled: 'Cancelada',
}

const CANCEL_REASON_LABELS: Record<string, string> = {
    user_cancelled: 'pelo dono',
    expired: 'expirou no fechamento do dia',
    no_liquidity: 'sem liquidez',
    requoted: 'recotada por Market Maker',
    insufficient_funds: 'dono sem saldo ou posição',
    admin: 'por intervenção do admin',
}

// Só ordem em repouso (aberta ou parcial) pode ser cancelada.
export function isCancellable(order: AdminOrder): boolean {
    return order.status === 'pending' || order.status === 'partially_filled'
}

export function describeCancelReason(reason: string | null): string | null {
    if (reason === null) return null
    return CANCEL_REASON_LABELS[reason] ?? reason
}

// "Bot (Market Maker)" ou os 8 primeiros caracteres do id do usuário (id curto, o
// bastante pra colar no filtro de dono sem poluir a linha).
export function describeOwner(order: AdminOrder): string {
    if (order.is_bot) {
        return order.bot_archetype ? `Bot (${describeArchetype(order.bot_archetype)})` : 'Bot'
    }
    return `Usuário ${order.user_id.slice(0, 8)}`
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: string): boolean {
    return UUID_PATTERN.test(value)
}

// Mensagens fixas por situação conhecida do motor; qualquer outra vira a genérica.
export function describeCancelError(err: unknown): string {
    if (err instanceof ApiError) {
        if (err.status === 404) return 'Essa ordem não existe mais.'
        if (err.status === 409) return 'Essa ordem já foi executada ou cancelada. A lista foi atualizada.'
        if (err.status === 422) {
            const details = err.details as { code?: string; matched?: number; max?: number } | undefined
            if (details?.code === 'batch_too_large') {
                return `O filtro atinge ${details.matched} ordens, acima do teto de ${details.max} por lote. Nada foi cancelado: estreite o filtro.`
            }
        }
    }
    return 'Não foi possível cancelar agora. Confira a lista e a auditoria antes de tentar de novo.'
}
