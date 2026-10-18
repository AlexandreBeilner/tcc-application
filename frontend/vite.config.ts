/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Gateway como porta de entrada única do backend (CLAUDE.md, spec seção 3) —
// o dev server local encaminha chamadas de API pro gateway containerizado,
// que por sua vez fala com o backend gamificado e, atrás dele, o motor.
// Em produção (vite build && vite preview, ou qualquer hospedagem estática
// — o frontend nunca roda em container, CLAUDE.md) não existe esse proxy:
// o cliente HTTP (src/services/client.ts, tarefa 6.0.2) fala direto com
// VITE_GATEWAY_URL, e quem garante que isso funciona é o CORS do backend
// (tarefa 6.0.1, backend/src/app.ts).
const GATEWAY_URL = process.env.VITE_GATEWAY_URL ?? 'http://localhost:8000'

// Um namespace por módulo do backend, nunca uma rota por rota — GET/POST/
// PATCH sob o mesmo prefixo não exigem entrada própria. Lista fechada com
// os módulos já existentes (health/status/auth/admin) e os previstos até o
// fim do roadmap (.claude/backlog-plataforma-investimentos.md, tarefa
// 6.0.3/6.0.6: market, news) — adicionar um módulo de backend inteiramente
// novo, fora desta lista, é o único caso que ainda exige editar este
// arquivo.
const BACKEND_ROUTE_NAMESPACES = [
    'health',
    'status',
    'auth',
    'me',
    'lessons',
    'missions',
    'achievements',
    'ranking',
    'friendships',
    'users',
    'admin',
    'market',
    'news',
    // EM.6.1 — `POST /email/unsubscribe` (cancelar inscrição); a página é `/cancelar-inscricao`, sem colisão.
    'email',
    // MO.2.3 — `GET /billing/status` e o webhook do RevenueCat; a página é `/planos`, sem colisão.
    'billing',
    // MO.5.2 — API das ligas privadas (`/leagues`); as páginas são `/ligas`, sem colisão.
    'leagues',
    // MO.5.3 — API dos duelos (`/duels`); as páginas são `/duelos`, sem colisão.
    'duels',
    // MO.5.4 — API da retrospectiva (`/retrospectives`); a página é `/retrospectiva`, sem colisão.
    'retrospectives',
    // MO.6.6 — API das assembleias de acionistas (`/assemblies`); as páginas são `/assembleias`, sem colisão.
    'assemblies',
    // Tarefa 6.10.8 — arquivos servidos por `express.static('/avatars', ...)`
    // no backend (`app.ts`), não uma rota de API "de verdade", mas ainda
    // assim um namespace que só o gateway sabe responder.
    'avatars',
]

// Rotas de página do frontend que colidem, por prefixo, com um namespace
// do backend acima — `/auth/callback` (tela 1.1, tarefa 6.2) vs. `/auth/*`
// do backend (register/login/google/google/callback/me), e `/admin`
// (Painel Administrativo, tarefa 6.1) vs. `/admin/*` do backend
// (ping/macro-events). Sem isso, o proxy abaixo repassaria a navegação
// inteira do navegador pro gateway em vez de deixar o Vite servir a SPA —
// só o path exato entra aqui, então `/admin/macro-events` etc. continuam
// proxiados normalmente.
const FRONTEND_ROUTES_SHADOWING_BACKEND = new Set(['/auth/callback', '/admin'])

// Desde a N.3 o painel admin tem várias rotas de página sob `/admin/*`
// (`/admin/eventos`, `/admin/eventos/novo`, e mais a cada tarefa da Fase N),
// todas colidindo com o namespace `admin` do backend. Listar uma a uma não
// escala, então no namespace `/admin` a decisão é pelo tipo de requisição:
// navegação do navegador (`Accept: text/html`, ex: F5 numa tela do painel) é
// servida pela SPA; chamada de API (`fetch`, `Accept: application/json` ou
// `*/*`) segue pro gateway.
function isAdminPageNavigation(path: string, accept: string | undefined) {
    return (path === '/admin' || path.startsWith('/admin/')) && (accept?.includes('text/html') ?? false)
}

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        react(),
        // LW.2.2: service worker próprio (`src/sw/sw.ts`) com a lista de arquivos do build injetada. O
        // manifest é o `public/manifest.webmanifest` (escrito à mão), por isso `manifest: false`; o registro
        // é feito por `features/pwa/serviceWorker` (não pelo plugin), porque a atualização é sempre avisada.
        // Só existe em build de produção: no `vite dev` não há service worker (não atrapalha o desenvolvimento).
        VitePWA({
            strategies: 'injectManifest',
            srcDir: 'src/sw',
            filename: 'sw.ts',
            registerType: 'prompt',
            injectRegister: false,
            manifest: false,
            injectManifest: {
                // App shell: JS e CSS com hash, a fonte latina, ícones, os sons das lições e a página offline. `index.html` fica de fora
                // (navegação vai à rede primeiro). `latin-ext` só baixa quando um caractere raro aparece.
                globPatterns: ['**/*.{js,css,woff2,png,svg,ico,wav}', 'offline.html'],
                globIgnores: [
                    '**/*latin-ext*',
                    '**/Purchases.es-*.js',
                    '**/Admin*.{js,css}',
                    '**/apple-touch-icon.png',
                    '**/icon-*-maskable.png',
                ],
            },
        }),
    ],
    server: {
        proxy: {
            // `(/|\?|$)` — não só `/` (path) ou fim de string, mas também `?`
            // (query string colada direto no namespace, sem segmento de path
            // no meio, ex: `/news?limit=20&offset=0`, tarefa 6.6.1). Gap real
            // achado nesta sessão: toda rota já testada até aqui tinha path
            // (`/market/assets?...`) ou nenhuma query (`/news` sozinho, usado
            // pelo badge) — `GET /news` paginado foi o primeiro caso de
            // querystring direto na raiz do namespace, e caía fora do regex
            // (404 do dev server, nunca chegava no proxy pro gateway).
            [`^/(${BACKEND_ROUTE_NAMESPACES.join('|')})(/|\\?|$)`]: {
                target: GATEWAY_URL,
                changeOrigin: true,
                bypass(req) {
                    const path = req.url?.split('?')[0] ?? ''
                    if (FRONTEND_ROUTES_SHADOWING_BACKEND.has(path) || isAdminPageNavigation(path, req.headers.accept)) {
                        return req.url
                    }
                },
            },
        },
    },
    test: {
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        globals: true,
    },
})
