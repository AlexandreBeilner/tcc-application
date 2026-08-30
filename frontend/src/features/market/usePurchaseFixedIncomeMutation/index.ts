import type { UseMutationResult } from '@tanstack/react-query'
import { purchaseFixedIncome } from '../../../services/market'
import type { PurchaseFixedIncomeInput, PurchaseFixedIncomeResult } from '../../../services/market'
import { useMarketMutation } from '../useMarketMutation'

export function usePurchaseFixedIncomeMutation(): UseMutationResult<PurchaseFixedIncomeResult, unknown, PurchaseFixedIncomeInput> {
    return useMarketMutation(purchaseFixedIncome)
}
