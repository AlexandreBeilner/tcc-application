import { Workbox } from 'workbox-window'
import { markUpdateWaiting } from '../updateStore'

// De quanto em quanto tempo um app deixado aberto (comum no PWA instalado) procura versão nova.
export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

// Registra o service worker (`src/sw/sw.ts`, publicado como `/sw.js`). Só em build de produção e em
// navegador com suporte; no `vite dev` não há service worker. Nunca recarrega a página sozinho:
// versão nova vira o aviso "Atualizar" (`UpdateNotice`), e o recarregamento só acontece depois do
// toque da pessoa.
export function registerServiceWorker(): void {
    if (!import.meta.env.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

    const workbox = new Workbox('/sw.js')
    let reloadWhenControlling = false

    // Disparado também quando a versão nova já estava esperando ao abrir o app.
    workbox.addEventListener('waiting', () => {
        markUpdateWaiting(() => {
            reloadWhenControlling = true
            workbox.messageSkipWaiting()
        })
    })

    // A primeira instalação também assume o controle; só recarrega se foi a pessoa que pediu a troca.
    workbox.addEventListener('controlling', () => {
        if (reloadWhenControlling) window.location.reload()
    })

    workbox
        .register()
        .then((registration) => {
            if (!registration) return
            const check = () => {
                registration.update().catch(() => {
                    // sem rede agora: tenta de novo na próxima vez
                })
            }
            window.setInterval(check, UPDATE_CHECK_INTERVAL_MS)
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') check()
            })
        })
        .catch(() => {
            // O app funciona sem service worker (só perde abrir mais rápido e a página offline).
        })
}
