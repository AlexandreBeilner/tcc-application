import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { getTradingHalts } from '../../../services/market'
import type { TradingHaltStatus } from '../../../services/market'
import { describeTradingHalt } from '../tradingHaltReason'

export const TRADING_HALTS_QUERY_KEY = ['market', 'halts'] as const

// A pausa muda por decisão do admin, não por tick: uma leitura a cada 30 s reabre os
// botões logo depois da retomada sem pesar no motor.
const REFETCH_INTERVAL_MS = 30_000

export function useTradingHaltQuery(): UseQueryResult<TradingHaltStatus> {
    const { token } = useAuth()

    return useQuery({
        queryKey: TRADING_HALTS_QUERY_KEY,
        queryFn: () => getTradingHalts(token as string),
        enabled: token !== null,
        refetchInterval: REFETCH_INTERVAL_MS,
        staleTime: 15_000,
    })
}

// Motivo pelo qual ordem neste ativo está barrada por pausa agora, ou `null`. O ativo
// sandbox nunca é pausado. Enquanto a leitura não carrega (ou falha) não bloqueia nada: a
// garantia real é o `409 trading_halted` do motor, isto é só o reflexo de UX.
export function useTradingHaltReason(assetId: string, isSandbox: boolean): string | null {
    const halts = useTradingHaltQuery()
    if (isSandbox || !halts.data) return null
    return describeTradingHalt(halts.data, assetId)
}
