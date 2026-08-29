import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { redeemFixedIncome } from '../../../services/market'
import type { RedeemFixedIncomeInput, RedeemFixedIncomeResult } from '../../../services/market'
import { MY_ACCOUNT_QUERY_KEY } from '../../portfolio/useMyAccountQuery'
import { MY_EVENTS_QUERY_KEY } from '../useMyEventsQuery'

export function useRedeemFixedIncomeMutation(): UseMutationResult<RedeemFixedIncomeResult, unknown, RedeemFixedIncomeInput> {
    const { token } = useAuth()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (input: RedeemFixedIncomeInput) => redeemFixedIncome(token as string, input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: MY_ACCOUNT_QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: MY_EVENTS_QUERY_KEY })
        },
    })
}
