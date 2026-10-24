/// <reference lib="webworker" />
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { OFFLINE_URL } from './constants'

// Service worker da Selucra (LW.2.2 e LW.2.3). Regras invioláveis:
//
// 1. Só guarda o app shell: JS, CSS, fontes e ícones com hash (o `__WB_MANIFEST` que o build injeta)
//    e a página offline. Nenhuma resposta de API é guardada, nunca: dado financeiro desatualizado é
//    pior que erro (RNF09). Por isso este arquivo NÃO
//    registra rota de runtime para `/auth`, `/me`, `/market`, `/ranking`, `/friendships`,
//    `/admin` nem para a origem da API: sem rota registrada, o navegador vai direto à rede.
// 2. A atualização é sempre avisada, nunca imposta: a versão nova fica esperando (`waiting`) até a
//    pessoa tocar em "Atualizar" (mensagem SKIP_WAITING), para não recarregar no meio de uma lição
//    ou de uma ordem.

declare const self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Navegação (abrir ou recarregar uma tela): sempre a rede primeiro, para o `index.html` ser o mais
// novo (ele é que aponta para os arquivos com hash). Sem rede, mostra a página offline da marca em
// vez do erro do navegador. O `index.html` fica fora do pré-cache de propósito.
registerRoute(
    new NavigationRoute(async ({ request }) => {
        try {
            return await fetch(request)
        } catch {
            return (await matchPrecache(OFFLINE_URL)) ?? Response.error()
        }
    }),
)

self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        void self.skipWaiting()
    }
})

// Ao assumir (depois de uma atualização aceita), controla as abas abertas na hora.
self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim())
})
