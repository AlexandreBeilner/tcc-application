// Estado "há versão nova esperando" do service worker (LW.2.2). Store mínimo para o React ler com
// `useSyncExternalStore`; quem o alimenta é `features/pwa/serviceWorker`. A atualização nunca é
// aplicada sozinha: só quando a pessoa toca em "Atualizar".

type Listener = () => void

const listeners = new Set<Listener>()
let waiting = false
let applier: (() => void) | null = null

export function subscribeToUpdate(listener: Listener): () => void {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

export function isUpdateWaiting(): boolean {
    return waiting
}

// Chamado pelo registro quando o service worker novo termina de instalar e fica esperando.
export function markUpdateWaiting(apply: () => void): void {
    waiting = true
    applier = apply
    listeners.forEach((listener) => listener())
}

// Aplica a versão nova (o registro troca o service worker e recarrega a página).
export function applyUpdate(): void {
    applier?.()
}

// Só para os testes.
export function resetUpdateStore(): void {
    waiting = false
    applier = null
    listeners.clear()
}
