import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/e2e/**/*.e2e.test.ts'],
    // As 3 jornadas avançam o dia simulado global via POST /admin/tick
    // (estado do Mercado Ao Vivo, único, sem escopo por teste) — rodar
    // arquivos em paralelo (default do Vitest) causa corrida real: um
    // arquivo confere "mercado aberto" e outro avança o relógio pro fim de
    // semana simulado antes da primeira chamada usar essa garantia
    // (achado ao vivo desta sessão, ver README).
    fileParallelism: false,
    // Jornadas avançam dezenas de dias simulados via POST /admin/tick e
    // completam lições reais (intervalo mínimo entre passos, .docs/backend/
    // lessons.md) — minutos por teste é o normal aqui, não uma regressão de
    // performance (ver test/e2e/README.md).
    testTimeout: 20 * 60 * 1000,
    hookTimeout: 60 * 1000,
  },
})
