import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computeInstallMode, dismissInstallInvite, INSTALL_INVITE_SNOOZE_MS, isInstallInviteDismissed, isIosSafari, isStandalone } from '.'

const IPHONE_SAFARI =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
const IPHONE_CHROME =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0 Mobile/15E148 Safari/604.1'
const IPAD_AS_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'
const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36'

describe('isIosSafari (LW.2.4)', () => {
    it('reconhece o Safari do iPhone', () => expect(isIosSafari(IPHONE_SAFARI, 5)).toBe(true))
    it('reconhece o iPad que se apresenta como Mac', () => expect(isIosSafari(IPAD_AS_MAC, 5)).toBe(true))
    it('não confunde com Mac de verdade (sem toque)', () => expect(isIosSafari(IPAD_AS_MAC, 0)).toBe(false))
    it('Chrome do iPhone não tem "Adicionar à Tela de Início" igual', () => expect(isIosSafari(IPHONE_CHROME, 5)).toBe(false))
    it('Android não é iOS', () => expect(isIosSafari(ANDROID_CHROME, 5)).toBe(false))
})

describe('computeInstallMode (LW.2.4)', () => {
    const base = { standalone: false, installed: false, hasPrompt: false, iosSafari: false }

    it.each([
        ['navegador com evento de instalação', { ...base, hasPrompt: true }, 'native'],
        ['Safari do iPhone', { ...base, iosSafari: true }, 'ios'],
        ['navegador sem suporte', base, 'none'],
        ['já aberto como app instalado', { ...base, standalone: true, hasPrompt: true }, 'none'],
        ['acabou de instalar', { ...base, installed: true, iosSafari: true }, 'none'],
    ] as const)('%s', (_name, input, expected) => {
        expect(computeInstallMode(input)).toBe(expected)
    })
})

describe('isStandalone (LW.2.4)', () => {
    afterEach(() => vi.unstubAllGlobals())

    it('usa display-mode: standalone', () => {
        vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))
        expect(isStandalone()).toBe(true)
    })

    it('é falso no navegador comum', () => {
        vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
        expect(isStandalone()).toBe(false)
    })
})

describe('convite dispensado (LW.2.4)', () => {
    beforeEach(() => localStorage.clear())

    it('não está dispensado por padrão', () => {
        expect(isInstallInviteDismissed()).toBe(false)
    })

    it('fica dispensado por 30 dias e depois volta', () => {
        const now = Date.UTC(2026, 9, 12)
        dismissInstallInvite(now)

        expect(isInstallInviteDismissed(now + INSTALL_INVITE_SNOOZE_MS - 1)).toBe(true)
        expect(isInstallInviteDismissed(now + INSTALL_INVITE_SNOOZE_MS)).toBe(false)
    })

    it('sem localStorage, o convite apenas continua aparecendo', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('bloqueado')
        })
        expect(isInstallInviteDismissed()).toBe(false)
        vi.restoreAllMocks()
    })
})
