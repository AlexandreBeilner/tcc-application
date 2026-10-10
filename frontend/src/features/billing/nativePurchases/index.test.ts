import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WebPlan } from '../webPurchases'
import { createNativePurchases, NativePurchasesError } from '.'

const RESPONSE_EVENT = 'investimenta:purchases-response'
const PLAN: WebPlan = { id: 'annual', formattedPrice: 'R$ 1', amountMicros: 1, currency: 'BRL', handle: null }

// Simula o app: lê o pedido enviado por postMessage e responde com o evento `window`.
function installApp(reply: ((request: Record<string, unknown>) => Record<string, unknown> | null) | null) {
    const posted: Record<string, unknown>[] = []
    ;(window as unknown as Record<string, unknown>).ReactNativeWebView = {
        postMessage: (raw: string) => {
            const request = JSON.parse(raw)
            posted.push(request)
            const response = reply?.(request)
            if (response) {
                setTimeout(() => {
                    window.dispatchEvent(
                        new CustomEvent(RESPONSE_EVENT, { detail: { requestId: request.requestId, op: request.op, ...response } }),
                    )
                }, 0)
            }
        },
    }
    return posted
}

describe('createNativePurchases (MO.4.2)', () => {
    beforeEach(() => vi.useRealTimers())
    afterEach(() => {
        delete (window as unknown as Record<string, unknown>).ReactNativeWebView
    })

    it('planos vêm da loja, pelo app', async () => {
        const posted = installApp(() => ({
            status: 'ok',
            plans: [{ id: 'monthly', formattedPrice: 'R$ 19,90', amountMicros: 19_900_000, currency: 'BRL' }],
        }))

        const plans = await createNativePurchases().loadPlans()

        expect(plans).toEqual([{ id: 'monthly', formattedPrice: 'R$ 19,90', amountMicros: 19_900_000, currency: 'BRL', handle: null }])
        expect(posted[0]).toMatchObject({ type: 'investimenta:purchases-request', op: 'plans' })
    })

    it('compra envia o plano e devolve purchased', async () => {
        const posted = installApp(() => ({ status: 'ok' }))
        expect(await createNativePurchases().purchase(PLAN)).toBe('purchased')
        expect(posted[0]).toMatchObject({ op: 'purchase', plan: 'annual' })
    })

    it('cancelar a folha da loja volta como cancelled, sem erro', async () => {
        installApp(() => ({ status: 'cancelled' }))
        expect(await createNativePurchases().purchase(PLAN)).toBe('cancelled')
    })

    it('erro do app vira NativePurchasesError com o motivo', async () => {
        installApp(() => ({ status: 'error', reason: 'unavailable' }))
        await expect(createNativePurchases().purchase(PLAN)).rejects.toMatchObject({ reason: 'unavailable' })
        installApp(() => ({ status: 'error' }))
        await expect(createNativePurchases().purchase(PLAN)).rejects.toMatchObject({ reason: 'failed' })
    })

    it('ignora resposta de outro pedido', async () => {
        installApp((request) => {
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent(RESPONSE_EVENT, { detail: { requestId: 'outro', op: 'purchase', status: 'error' } }))
            }, 0)
            return { requestId: request.requestId, status: 'ok' }
        })
        expect(await createNativePurchases().purchase(PLAN)).toBe('purchased')
    })

    it('app que não responde (versão antiga) estoura o tempo dos pedidos rápidos', async () => {
        installApp(null)
        vi.useFakeTimers()
        const promise = createNativePurchases().loadPlans()
        const assertion = expect(promise).rejects.toBeInstanceOf(NativePurchasesError)
        await vi.advanceTimersByTimeAsync(21_000)
        await assertion
    })

    it('restaurar informa se a loja devolveu PRO; gerenciar pede a abertura da loja', async () => {
        const posted = installApp((request) => (request.op === 'restore' ? { status: 'ok', hasPro: true } : { status: 'ok' }))
        const purchases = createNativePurchases()
        expect(await purchases.restore?.()).toEqual({ hasPro: true })
        await purchases.manage?.('https://apps.apple.com/account/subscriptions')
        expect(posted[1]).toMatchObject({ op: 'manage', url: 'https://apps.apple.com/account/subscriptions' })
    })

    it('fora do app não há ponte: indisponível', async () => {
        await expect(createNativePurchases().loadPlans()).rejects.toMatchObject({ reason: 'unavailable' })
    })
})
