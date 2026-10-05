import type { TradingHaltStatus } from '../../../services/market'

// Motivo em texto pro botão de ordem desabilitado quando há pausa de negociação (N.9),
// nunca só cor: `null` se nada barra este ativo. A pausa global tem prioridade (a mais
// restritiva). O motivo interno do admin não chega ao usuário.
export function describeTradingHalt(status: TradingHaltStatus, assetId: string): string | null {
    if (status.global) {
        return 'Negociação pausada em todo o mercado pela administração. As ordens voltam quando a pausa for encerrada.'
    }
    if (status.asset_ids.includes(assetId)) {
        return 'Negociação pausada neste ativo pela administração. As ordens voltam quando a pausa for encerrada.'
    }
    return null
}
