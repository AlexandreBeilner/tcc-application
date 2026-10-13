import { useSyncExternalStore } from 'react'
import { readStored, STORAGE_KEYS, writeStored } from '../../../utils/storage'

// Instalação do app como PWA (LW.2.4). Convite, nunca insistência (M6): aparece num ponto natural
// (depois da primeira lição concluída e em Configurações), pode ser dispensado e some depois de
// instalado.
//
// - Android/Chrome e desktop (Chrome, Edge): o navegador dispara `beforeinstallprompt`; guardamos o
//   evento e o usamos quando a pessoa toca em "Instalar".
// - iPhone/iPad (Safari): não existe esse evento, então mostramos a instrução manual
//   ("Compartilhar, Adicionar à Tela de Início").

export const INSTALL_INVITE_SNOOZE_MS = 30 * 24 * 60 * 60 * 1000

// `beforeinstallprompt` ainda não está nos tipos do DOM.
interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallMode = 'native' | 'ios' | 'none'

type Listener = () => void

const listeners = new Set<Listener>()
let deferredPrompt: BeforeInstallPromptEvent | null = null
let installed = false

function notify() {
    cachedMode = null
    listeners.forEach((listener) => listener())
}

// Aberto pelo ícone da tela inicial (`display-mode: standalone`) ou, no iOS, `navigator.standalone`.
export function isStandalone(): boolean {
    if (typeof window === 'undefined') return false
    const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
    return iosStandalone || (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches)
}

// Safari do iPhone/iPad. Outros navegadores do iOS (Chrome, Firefox) usam o mesmo motor mas não
// oferecem "Adicionar à Tela de Início" da mesma forma, então a instrução só vale para o Safari.
// iPadOS recente se identifica como Mac: o toque múltiplo o denuncia.
export function isIosSafari(userAgent: string = navigator.userAgent, maxTouchPoints: number = navigator.maxTouchPoints): boolean {
    const iosDevice = /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)
    const otherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(userAgent)
    return iosDevice && !otherBrowser && /Safari/.test(userAgent)
}

export function computeInstallMode(input: {
    standalone: boolean
    installed: boolean
    hasPrompt: boolean
    iosSafari: boolean
}): InstallMode {
    if (input.standalone || input.installed) return 'none'
    if (input.hasPrompt) return 'native'
    return input.iosSafari ? 'ios' : 'none'
}

let cachedMode: InstallMode | null = null

function getMode(): InstallMode {
    cachedMode ??= computeInstallMode({
        standalone: isStandalone(),
        installed,
        hasPrompt: deferredPrompt !== null,
        iosSafari: isIosSafari(),
    })
    return cachedMode
}

function subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

// Chamada uma vez na inicialização (main.tsx), antes de o navegador disparar o evento.
export function listenForInstall(): void {
    if (typeof window === 'undefined') return
    window.addEventListener('beforeinstallprompt', (event) => {
        // Impede o mini-aviso automático do Chrome: o convite é nosso, no momento certo.
        event.preventDefault()
        deferredPrompt = event as BeforeInstallPromptEvent
        notify()
    })
    window.addEventListener('appinstalled', () => {
        installed = true
        deferredPrompt = null
        notify()
    })
}

// Abre o diálogo de instalação do navegador. `true` se a pessoa aceitou.
export async function promptInstall(): Promise<boolean> {
    const event = deferredPrompt
    if (!event) return false
    // O evento só pode ser usado uma vez.
    deferredPrompt = null
    notify()
    await event.prompt()
    const choice = await event.userChoice
    if (choice.outcome === 'accepted') installed = true
    notify()
    return choice.outcome === 'accepted'
}

export function isInstallInviteDismissed(now: number = Date.now()): boolean {
    try {
        const raw = readStored(STORAGE_KEYS.installInviteDismissed)
        const at = raw === null ? NaN : Number(raw)
        return Number.isFinite(at) && now - at < INSTALL_INVITE_SNOOZE_MS
    } catch {
        return false
    }
}

export function dismissInstallInvite(now: number = Date.now()): void {
    try {
        writeStored(STORAGE_KEYS.installInviteDismissed, String(now))
    } catch {
        // armazenamento indisponível: o convite some só nesta visita
    }
}

// Popup de instalação logo depois do onboarding: aparece uma vez só. Quem recusou encontra o convite
// em Configurações (sempre visível) e, depois da primeira lição, na trilha.
export function hasSeenInstallPrompt(): boolean {
    try {
        return readStored(STORAGE_KEYS.installPromptSeen) !== null
    } catch {
        return false
    }
}

export function markInstallPromptSeen(now: number = Date.now()): void {
    try {
        writeStored(STORAGE_KEYS.installPromptSeen, String(now))
    } catch {
        // armazenamento indisponível: pode reaparecer na próxima abertura, sem prejuízo
    }
}

export function useInstallMode(): InstallMode {
    return useSyncExternalStore(subscribe, getMode, () => 'none')
}

// Só para os testes.
export function resetInstallState(): void {
    deferredPrompt = null
    installed = false
    listeners.clear()
    cachedMode = null
}
