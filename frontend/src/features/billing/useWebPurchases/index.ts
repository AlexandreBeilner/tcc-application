import { useMemo } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { createNativePurchases } from '../nativePurchases'
import { isNativeApp } from '../isNativeApp'
import { createRevenueCatWebPurchases, WEB_PUBLIC_KEY } from '../webPurchases'
import type { WebPurchases } from '../webPurchases'

// Compra da conta logada: nativa (pela ponte do app) dentro do WebView, web (SDK do RevenueCat)
// no navegador. `null` sem sessão, ou no navegador sem a chave pública configurada (ambiente sem
// cobrança). Telas testam trocando este hook.
export function useWebPurchases(): WebPurchases | null {
    const { user } = useAuth()
    const userId = user?.id ?? null

    return useMemo(() => {
        if (!userId) return null
        if (isNativeApp()) return createNativePurchases()
        return WEB_PUBLIC_KEY ? createRevenueCatWebPurchases(WEB_PUBLIC_KEY, userId) : null
    }, [userId])
}
