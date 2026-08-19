/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Gateway como porta de entrada única do backend (CLAUDE.md, spec seção 3) —
// o dev server local encaminha chamadas de API pro gateway containerizado,
// que por sua vez fala com o backend gamificado e, atrás dele, o motor.
const GATEWAY_URL = process.env.VITE_GATEWAY_URL ?? 'http://localhost:8000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/health': GATEWAY_URL,
      '/status': GATEWAY_URL,
      '/auth': GATEWAY_URL,
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
})
