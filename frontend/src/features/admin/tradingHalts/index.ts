import { ApiError } from '../../../services/client'
import type { TradingHalt } from '../../../services/admin'

export const REASON_MAX_LENGTH = 200

// Texto digitado pra confirmar a pausa global (regra transversal 6 da Fase N).
export const PAUSE_ALL_CONFIRMATION = 'PAUSAR TUDO'

// Ativos com pausa vigente (pra desabilitar "Pausar ativo" no que já está pausado).
export function haltedAssetIds(active: TradingHalt[]): Set<string> {
    return new Set(active.flatMap((halt) => (halt.scope === 'asset' && halt.asset_id ? [halt.asset_id] : [])))
}

export function hasGlobalHalt(active: TradingHalt[]): boolean {
    return active.some((halt) => halt.scope === 'global')
}

// Mensagens fixas por situação conhecida do motor; qualquer outra vira a genérica.
export function describeHaltError(err: unknown): string {
    if (err instanceof ApiError) {
        if (err.status === 409) return 'O estado dessa pausa mudou (já pausado ou já retomado). A lista foi atualizada.'
        if (err.status === 404) return 'Essa pausa ou esse ativo não existe mais.'
        if (err.status === 400) return 'O motor recusou a pausa: confira o ativo e o motivo.'
    }
    return 'Não foi possível concluir agora. Confira a lista e a auditoria antes de tentar de novo.'
}
