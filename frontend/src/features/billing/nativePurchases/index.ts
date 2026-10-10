import type { PurchaseOutcome, WebPlan, WebPurchases } from '../webPurchases'

// Protocolo da ponte (espelho de `mobile/purchasesBridge.ts`; não há import entre os pacotes, os
// dois lados precisam ficar sincronizados à mão).
const REQUEST_TYPE = 'investimenta:purchases-request'
const RESPONSE_EVENT = 'investimenta:purchases-response'

// Planos, restauração e gerenciamento respondem rápido; a compra espera a pessoa na folha de
// pagamento da loja, então não tem limite (o app sempre responde: compra, cancelou ou erro).
const QUICK_TIMEOUT_MS = 20_000

interface NativeResponse {
    requestId: string
    op: string
    status: 'ok' | 'cancelled' | 'error'
    plans?: { id: 'monthly' | 'annual'; formattedPrice: string; amountMicros: number; currency: string }[]
    hasPro?: boolean
    reason?: 'unavailable' | 'failed'
}

// `unavailable`: este build do app não tem compras (chave em branco); `timeout`: o app não
// respondeu (versão antiga sem a ponte).
export class NativePurchasesError extends Error {
    reason: 'unavailable' | 'failed' | 'timeout'

    constructor(reason: 'unavailable' | 'failed' | 'timeout') {
        super(`compra nativa: ${reason}`)
        this.name = 'NativePurchasesError'
        this.reason = reason
    }
}

interface WebViewBridge {
    postMessage(message: string): void
}

function newRequestId(): string {
    return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function request(payload: Record<string, unknown>, timeoutMs: number | null): Promise<NativeResponse> {
    const bridge = (window as unknown as { ReactNativeWebView?: WebViewBridge }).ReactNativeWebView
    if (!bridge) return Promise.reject(new NativePurchasesError('unavailable'))

    return new Promise((resolve, reject) => {
        const requestId = newRequestId()
        let timer: ReturnType<typeof setTimeout> | undefined

        const finish = () => {
            window.removeEventListener(RESPONSE_EVENT, onResponse)
            if (timer) clearTimeout(timer)
        }
        const onResponse = (event: Event) => {
            const detail = (event as CustomEvent<NativeResponse>).detail
            if (!detail || detail.requestId !== requestId) return
            finish()
            resolve(detail)
        }

        window.addEventListener(RESPONSE_EVENT, onResponse)
        if (timeoutMs !== null) {
            timer = setTimeout(() => {
                finish()
                reject(new NativePurchasesError('timeout'))
            }, timeoutMs)
        }
        bridge.postMessage(JSON.stringify({ type: REQUEST_TYPE, requestId, ...payload }))
    })
}

function expectOk(response: NativeResponse): NativeResponse {
    if (response.status === 'error') throw new NativePurchasesError(response.reason ?? 'failed')
    return response
}

// Compra dentro do app (MO.4.2/MO.4.3): a mesma porta da compra web, mas quem fala com a loja é o
// app. Os preços vêm da loja (as lojas exigem), nunca de texto nosso. Nenhum caminho de pagamento
// web é aberto daqui.
export function createNativePurchases(): WebPurchases {
    return {
        async loadPlans(): Promise<WebPlan[]> {
            const response = expectOk(await request({ op: 'plans' }, QUICK_TIMEOUT_MS))
            return (response.plans ?? []).map((plan) => ({ ...plan, handle: null }))
        },
        async purchase(plan): Promise<PurchaseOutcome> {
            const response = expectOk(await request({ op: 'purchase', plan: plan.id }, null))
            return response.status === 'cancelled' ? 'cancelled' : 'purchased'
        },
        async restore() {
            const response = expectOk(await request({ op: 'restore' }, QUICK_TIMEOUT_MS * 3))
            return { hasPro: response.hasPro === true }
        },
        async manage(url) {
            expectOk(await request({ op: 'manage', url }, QUICK_TIMEOUT_MS))
        },
    }
}
