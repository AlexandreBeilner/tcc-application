import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { purchaseFixedIncome } from '../../../services/market'
import type { PurchaseFixedIncomeInput, PurchaseFixedIncomeResult } from '../../../services/market'
import { MY_ACCOUNT_QUERY_KEY } from '../../portfolio/useMyAccountQuery'
import { MY_EVENTS_QUERY_KEY } from '../useMyEventsQuery'

export function usePurchaseFixedIncomeMutation(): UseMutationResult<PurchaseFixedIncomeResult, unknown, PurchaseFixedIncomeInput> {
    const { token } = useAuth()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (input: PurchaseFixedIncomeInput) => purchaseFixedIncome(token as string, input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: MY_ACCOUNT_QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: MY_EVENTS_QUERY_KEY })
        },
    })
}
