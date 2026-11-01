import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Com banco, todos os arquivos de integração dividem o mesmo TEST_DATABASE_URL e vários limpam tabelas
    // inteiras: em paralelo, um apaga o que o outro acabou de gravar. Sem banco, segue paralelo.
    fileParallelism: !process.env.TEST_DATABASE_URL,
  },
})
