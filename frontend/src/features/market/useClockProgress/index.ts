import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { MarketClock } from '../../../services/market'
import { clockProgress } from '../clockProgress'
import { MARKET_CLOCK_QUERY_KEY } from '../useMarketClockQuery'

const TICK_MS = 30_000

// Ponteiro do relógio andando durante o dia simulado (decisão S.12): timer local
// de ~30 s sobre `next_tick_at`, sem bater no servidor a cada passo. Quando a
// volta se completa, relê `GET /market/clock` (o dia virou). `null` sem agenda.
export function useClockProgress(clock: MarketClock | undefined): { progress: number | null; now: Date } {
    const queryClient = useQueryClient()
    const [now, setNow] = useState(() => new Date())

    useEffect(() => {
        if (!clock?.next_tick_at) return
        const timer = setInterval(() => setNow(new Date()), TICK_MS)
        return () => clearInterval(timer)
    }, [clock?.next_tick_at])

    const progress = clock ? clockProgress(clock, now) : null
    const lapCompleted = progress !== null && progress >= 1

    useEffect(() => {
        if (lapCompleted) void queryClient.invalidateQueries({ queryKey: MARKET_CLOCK_QUERY_KEY })
    }, [lapCompleted, queryClient])

    return { progress, now }
}
