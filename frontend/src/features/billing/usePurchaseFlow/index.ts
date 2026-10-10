import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { getBillingStatus } from '../../../services/billing'
import { BILLING_STATUS_QUERY_KEY } from '../useBillingStatus'
import { useWebPurchases } from '../useWebPurchases'
import type { WebPlan } from '../webPurchases'

// idle: nada em curso. checkout: janela de pagamento aberta. confirming: pago, esperando o webhook
// do RevenueCat chegar ao nosso servidor. timeout: demorou além do limite (a compra pode estar ok).
export type PurchasePhase = 'idle' | 'checkout' | 'confirming' | 'timeout' | 'error'

export interface PurchaseFlowOptions {
    intervalMs?: number
    timeoutMs?: number
}

// Compra na web e retorno (MO.3.2). A verdade é o servidor: o fim do checkout nunca dá PRO, só
// inicia a consulta curta a `GET /billing/status` até `isPro` (ou até o limite de tempo).
export function usePurchaseFlow({ intervalMs = 2000, timeoutMs = 60_000 }: PurchaseFlowOptions = {}) {
    const { token } = useAuth()
    const webPurchases = useWebPurchases()
    const queryClient = useQueryClient()
    const [phase, setPhase] = useState<PurchasePhase>('idle')
    const aborted = useRef(false)

    useEffect(() => {
        aborted.current = false
        return () => {
            aborted.current = true
        }
    }, [])

    const confirm = useCallback(async () => {
        setPhase('confirming')
        const deadline = Date.now() + timeoutMs
        while (!aborted.current && Date.now() < deadline) {
            try {
                const status = await getBillingStatus(token as string)
                queryClient.setQueryData(BILLING_STATUS_QUERY_KEY, status)
                if (status.isPro) {
                    if (!aborted.current) setPhase('idle')
                    return
                }
            } catch {
                // Falha de rede no meio da espera: tenta de novo até o limite.
            }
            await new Promise((resolve) => setTimeout(resolve, intervalMs))
        }
        if (!aborted.current) setPhase('timeout')
    }, [token, queryClient, intervalMs, timeoutMs])

    const start = useCallback(
        async (plan: WebPlan) => {
            if (!webPurchases) return
            setPhase('checkout')
            try {
                const outcome = await webPurchases.purchase(plan)
                if (aborted.current) return
                if (outcome === 'cancelled') {
                    setPhase('idle')
                    return
                }
                await confirm()
            } catch {
                if (!aborted.current) setPhase('error')
            }
        },
        [webPurchases, confirm],
    )

    return { phase, start, canPurchase: webPurchases !== null }
}
