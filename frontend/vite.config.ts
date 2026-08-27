/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Gateway como porta de entrada única do backend (CLAUDE.md, spec seção 3) —
// o dev server local encaminha chamadas de API pro gateway containerizado,
// que por sua vez fala com o backend gamificado e, atrás dele, o motor.
// Em produção (vite build && vite preview, ou qualquer hospedagem estática
// — o frontend nunca roda em container, CLAUDE.md) não existe esse proxy:
// o cliente HTTP (src/api/client.ts, tarefa 6.0.2) fala direto com
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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      [`^/(${BACKEND_ROUTE_NAMESPACES.join('|')})(/|$)`]: {
        target: GATEWAY_URL,
        changeOrigin: true,
        bypass(req) {
          const path = req.url?.split('?')[0] ?? ''
          if (FRONTEND_ROUTES_SHADOWING_BACKEND.has(path)) {
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
