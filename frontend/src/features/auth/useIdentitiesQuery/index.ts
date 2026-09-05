import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../AuthContext'
import { listIdentities } from '../../../services/auth'
import type { Identity } from '../../../services/auth'

// Tela 9.2 (tarefa 6.10) — lista de provedores conectados, só leitura
// nesta fase (sem desvincular, não pedido no inventário/backlog).
export function useIdentitiesQuery(): UseQueryResult<{ identities: Identity[] }> {
    const { token } = useAuth()

    return useQuery({
        queryKey: ['identities', 'me'] as const,
        queryFn: () => listIdentities(token as string),
        enabled: token !== null,
    })
}
