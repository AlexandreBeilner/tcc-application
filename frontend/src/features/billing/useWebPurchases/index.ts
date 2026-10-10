import { useMemo } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { createRevenueCatWebPurchases, WEB_PUBLIC_KEY } from '../webPurchases'
import type { WebPurchases } from '../webPurchases'

// Compra web da conta logada, ou `null` quando a chave pública do RevenueCat não está
// configurada (ambiente sem cobrança). Telas testam trocando este hook.
export function useWebPurchases(): WebPurchases | null {
    const { user } = useAuth()
    const userId = user?.id ?? null

    return useMemo(() => (WEB_PUBLIC_KEY && userId ? createRevenueCatWebPurchases(WEB_PUBLIC_KEY, userId) : null), [userId])
}
