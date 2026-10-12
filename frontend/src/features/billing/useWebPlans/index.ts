import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useWebPurchases } from '../useWebPurchases'
import type { WebPlan } from '../webPurchases'

// Planos com o preço do Offering do RevenueCat. Só busca se a cobrança está ligada no servidor e
// a chave pública existe; senão a tela não mostra preço nenhum (nunca um valor inventado).
export function useWebPlansQuery(enabled: boolean): UseQueryResult<WebPlan[]> {
    const webPurchases = useWebPurchases()

    return useQuery({
        queryKey: ['billing', 'web-plans'],
        queryFn: () => (webPurchases as NonNullable<typeof webPurchases>).loadPlans(),
        enabled: enabled && webPurchases !== null,
        staleTime: 5 * 60 * 1000,
    })
}
