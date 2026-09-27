import { describeMarketClosed } from '../marketClosedReason'
import { useMarketClockQuery } from '../useMarketClockQuery'

// Motivo pelo qual ordem/aporte/resgate está desabilitado agora, ou `null`. O
// ativo sandbox (Modo Aprendizado) segue aberto no fim de semana. Enquanto o
// relógio não carrega (ou falha) não bloqueia nada: a garantia real é o `422
// market_closed` do motor, isto é só o reflexo de UX.
export function useMarketClosedReason(isSandbox: boolean): string | null {
    const clock = useMarketClockQuery()
    if (isSandbox || !clock.data) return null
    return describeMarketClosed(clock.data)
}
