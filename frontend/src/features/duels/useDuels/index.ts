import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { cancelDuel, createDuel, getDuel, listDuels, respondToDuel } from '../../../services/duels'
import type { Duel } from '../../../services/duels'

export const DUELS_QUERY_KEY = ['duels'] as const

// Duelos da própria conta (MO.5.3): em andamento, convites e histórico.
export function useDuelsQuery(): UseQueryResult<Duel[]> {
    const { token } = useAuth()
    return useQuery({
        queryKey: [...DUELS_QUERY_KEY, 'list'] as const,
        queryFn: () => listDuels(token as string),
        enabled: token !== null,
    })
}

// Em andamento o placar parcial muda sozinho com o mercado; relê a cada minuto.
export function useDuelQuery(id: string): UseQueryResult<Duel> {
    const { token } = useAuth()
    return useQuery({
        queryKey: [...DUELS_QUERY_KEY, 'detail', id] as const,
        queryFn: () => getDuel(token as string, id),
        enabled: token !== null,
        refetchInterval: (query) => (query.state.data?.status === 'active' ? 60_000 : false),
    })
}

function useDuelMutation<TVariables, TResult = void>(
    action: (token: string, variables: TVariables) => Promise<TResult>,
): UseMutationResult<TResult, unknown, TVariables> {
    const { token } = useAuth()
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (variables: TVariables) => action(token as string, variables),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: DUELS_QUERY_KEY }),
    })
}

export const useCreateDuelMutation = () => useDuelMutation((token, opponentId: string) => createDuel(token, opponentId))
export const useRespondToDuelMutation = () =>
    useDuelMutation((token, v: { id: string; accept: boolean }) => respondToDuel(token, v.id, v.accept))
export const useCancelDuelMutation = () => useDuelMutation((token, id: string) => cancelDuel(token, id))
