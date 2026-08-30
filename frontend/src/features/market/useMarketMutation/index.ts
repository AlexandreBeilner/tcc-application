import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { MY_ACCOUNT_QUERY_KEY } from '../../portfolio/useMyAccountQuery'
import { MY_EVENTS_QUERY_KEY } from '../useMyEventsQuery'

// Base comum das 3 mutations de execução real de mercado (ordem de renda
// variável, aporte/resgate de renda fixa) — todas invalidam conta e
// extrato do próprio usuário, os dois únicos dados que mudam de verdade
// com uma operação preenchida (`.docs/backend/market.md`), e diferem só
// na função de serviço/tipos plugados.
export function useMarketMutation<TInput, TResult>(
    mutationFn: (token: string, input: TInput) => Promise<TResult>,
): UseMutationResult<TResult, unknown, TInput> {
    const { token } = useAuth()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (input: TInput) => mutationFn(token as string, input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: MY_ACCOUNT_QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: MY_EVENTS_QUERY_KEY })
        },
    })
}
