import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { getBillingStatus } from '../../../services/billing'
import { BILLING_STATUS_QUERY_KEY } from '../useBillingStatus'
import { useWebPurchases } from '../useWebPurchases'
import type { WebPlan } from '../webPurchases'

// idle: nada em curso. checkout: janela de pagamento aberta. confirming: pago, esperando o webhook
// do RevenueCat chegar ao nosso servidor. timeout: demorou além do limite (a compra pode estar ok).
// restoring: perguntando à loja pelas compras desta conta. nothing-to-restore: a loja não tem
// assinatura ativa para restaurar.
export type PurchasePhase = 'idle' | 'checkout' | 'restoring' | 'confirming' | 'timeout' | 'nothing-to-restore' | 'error'

// O que a pessoa estava fazendo, para a tela escolher a mensagem certa de espera e de erro.
export type PurchaseAction = 'purchase' | 'restore'

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
    const [action, setAction] = useState<PurchaseAction>('purchase')
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
            setAction('purchase')
            setPhase('checkout')
            try {
                // Confere o plano com o servidor ANTES de abrir a folha de pagamento: quem já é PRO
                // (inclusive por outra plataforma, com a tela desatualizada) nunca paga de novo. Se
                // a conferência falha, não compra: erro, e a pessoa tenta de novo.
                const current = await getBillingStatus(token as string)
                queryClient.setQueryData(BILLING_STATUS_QUERY_KEY, current)
                if (current.isPro) {
                    if (!aborted.current) setPhase('idle')
                    return
                }

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
        [webPurchases, confirm, token, queryClient],
    )

    // "Restaurar compras" (exigido pelas lojas): só existe dentro do app. Se a loja devolve um
    // direito ativo, o servidor ainda precisa confirmar (webhook), então reaproveita a espera da
    // compra. O servidor decide sozinho se já é PRO; aqui só se evita insistir à toa.
    const restore = useCallback(async () => {
        if (!webPurchases?.restore) return
        setAction('restore')
        setPhase('restoring')
        try {
            const { hasPro } = await webPurchases.restore()
            if (aborted.current) return
            if (!hasPro) {
                setPhase('nothing-to-restore')
                return
            }
            await confirm()
        } catch {
            if (!aborted.current) setPhase('error')
        }
    }, [webPurchases, confirm])

    return { phase, action, start, restore, canPurchase: webPurchases !== null, canRestore: typeof webPurchases?.restore === 'function' }
}
