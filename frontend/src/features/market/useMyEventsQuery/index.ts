import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { listMyEvents } from '../../../services/market'
import type { MarketEvent } from '../../../services/market'

export const MY_EVENTS_QUERY_KEY = ['market', 'me', 'events'] as const

// Extrato (tela 4.8) — `limit` alto o bastante pra cobrir a paginação real
// no cliente (filtro por tipo/período é client-side, backlog 6.5: "o
// backend não filtra por tipo/data na query, só pagina"); `100` é o máximo
// aceito por `.docs/backend/market.md`.
export function useMyEventsQuery(): UseQueryResult<{ events: MarketEvent[] }> {
    const { token } = useAuth()

    return useQuery({
        queryKey: MY_EVENTS_QUERY_KEY,
        queryFn: () => listMyEvents(token as string, 100, 0),
        enabled: token !== null,
    })
}
