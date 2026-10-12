import { afterEach, describe, expect, it, vi } from 'vitest'
import { isNativeApp, nativePlatform } from '.'

function stubStandalone(matches: boolean) {
    vi.stubGlobal(
        'matchMedia',
        vi.fn().mockImplementation((query: string) => ({ matches: matches && query.includes('standalone'), media: query })),
    )
}

// LW.1.3: o PWA instalado NÃO é o app nativo. Só a ponte do React Native (`ReactNativeWebView`) liga o
// caminho de compra por loja; `display-mode: standalone` não pode ligá-lo.
describe('isNativeApp (LW.1.3)', () => {
    afterEach(() => vi.unstubAllGlobals())

    it('é falso no navegador', () => {
        expect(isNativeApp()).toBe(false)
        expect(nativePlatform()).toBeNull()
    })

    it('continua falso no PWA instalado (display-mode: standalone)', () => {
        stubStandalone(true)
        expect(isNativeApp()).toBe(false)
        expect(nativePlatform()).toBeNull()
    })

    it('é verdadeiro só dentro do WebView do app', () => {
        Object.defineProperty(window, 'ReactNativeWebView', { value: {}, configurable: true })
        try {
            expect(isNativeApp()).toBe(true)
        } finally {
            delete (window as unknown as Record<string, unknown>).ReactNativeWebView
        }
    })
})
