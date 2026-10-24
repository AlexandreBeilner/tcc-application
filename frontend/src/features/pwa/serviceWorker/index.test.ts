import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyUpdate, isUpdateWaiting, resetUpdateStore } from '../updateStore'

const standalone = vi.hoisted(() => ({ value: true }))

vi.mock('../install', () => ({ isStandalone: () => standalone.value }))

type Handler = (event?: { wasWaitingBeforeRegister?: boolean }) => void

const workbox = vi.hoisted(() => {
    const handlers: Record<string, Handler> = {}
    return {
        handlers,
        instance: {
            addEventListener: vi.fn((name: string, handler: Handler) => {
                handlers[name] = handler
            }),
            register: vi.fn(),
            messageSkipWaiting: vi.fn(),
        },
        ctor: vi.fn(),
    }
})

vi.mock('workbox-window', () => ({
    Workbox: function (this: unknown, url: string) {
        workbox.ctor(url)
        return workbox.instance
    },
}))

import { registerServiceWorker } from '.'

describe('registerServiceWorker (LW.2.2)', () => {
    const reload = vi.fn()

    beforeEach(() => {
        resetUpdateStore()
        standalone.value = true
        for (const key of Object.keys(workbox.handlers)) delete workbox.handlers[key]
        workbox.instance.register.mockResolvedValue(undefined)
        vi.stubGlobal('navigator', { ...navigator, serviceWorker: {} })
        vi.stubGlobal('location', { ...window.location, reload })
    })

    afterEach(() => {
        vi.unstubAllEnvs()
        vi.unstubAllGlobals()
        vi.clearAllMocks()
    })

    it('não registra fora de produção (vite dev)', () => {
        vi.stubEnv('PROD', false)

        registerServiceWorker()

        expect(workbox.ctor).not.toHaveBeenCalled()
    })

    it('não registra em navegador sem service worker', () => {
        vi.stubEnv('PROD', true)
        vi.stubGlobal('navigator', {})

        registerServiceWorker()

        expect(workbox.ctor).not.toHaveBeenCalled()
    })

    it('registra /sw.js em produção', () => {
        vi.stubEnv('PROD', true)

        registerServiceWorker()

        expect(workbox.ctor).toHaveBeenCalledWith('/sw.js')
        expect(workbox.instance.register).toHaveBeenCalled()
    })

    it('no app instalado, versão nova vira aviso e só troca e recarrega depois do pedido', () => {
        vi.stubEnv('PROD', true)
        registerServiceWorker()

        ;(workbox.handlers.waiting as Handler)()
        expect(isUpdateWaiting()).toBe(true)
        expect(workbox.instance.messageSkipWaiting).not.toHaveBeenCalled()

        // Troca de controle antes do pedido (ex.: primeira instalação): não recarrega.
        ;(workbox.handlers.controlling as Handler)()
        expect(reload).not.toHaveBeenCalled()
    })

    it('depois do toque em Atualizar, pede a troca ao service worker e recarrega ao assumir', () => {
        vi.stubEnv('PROD', true)
        registerServiceWorker()
        ;(workbox.handlers.waiting as Handler)()

        applyUpdate()
        expect(workbox.instance.messageSkipWaiting).toHaveBeenCalledTimes(1)

        ;(workbox.handlers.controlling as Handler)()
        expect(reload).toHaveBeenCalledTimes(1)
    })

    it('numa aba comum do navegador, a versão que já esperava ao abrir assume sem aviso e sem recarregar', () => {
        vi.stubEnv('PROD', true)
        standalone.value = false
        registerServiceWorker()

        ;(workbox.handlers.waiting as Handler)({ wasWaitingBeforeRegister: true })
        expect(isUpdateWaiting()).toBe(false)
        expect(workbox.instance.messageSkipWaiting).toHaveBeenCalledTimes(1)

        ;(workbox.handlers.controlling as Handler)()
        expect(reload).not.toHaveBeenCalled()
    })

    it('numa aba comum do navegador, versão nova no meio da sessão não mostra aviso nem troca', () => {
        vi.stubEnv('PROD', true)
        standalone.value = false
        registerServiceWorker()

        ;(workbox.handlers.waiting as Handler)({ wasWaitingBeforeRegister: false })
        expect(isUpdateWaiting()).toBe(false)
        expect(workbox.instance.messageSkipWaiting).not.toHaveBeenCalled()
    })
})
