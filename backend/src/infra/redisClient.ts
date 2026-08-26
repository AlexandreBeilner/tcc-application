import { Redis } from 'ioredis'

// Primeira consumidora real de REDIS_URL no backend (tarefa 5.7) — mesma
// var de ambiente provisionada desde 1.2/1.1d, nunca usada até aqui.
// `lazyConnect: true` espelha o comportamento do Pool do Postgres (só
// conecta no primeiro uso, ver app.ts) — sem isso, `createApp()` chamado
// sem argumentos (testes de health/status que nunca tocam ranking, ex:
// health/status.test.ts) tentaria abrir um socket real logo na composição.
// `enableOfflineQueue: false` + `maxRetriesPerRequest: 1` fazem uma falha
// de conexão rejeitar rápido (fail-fast) em vez de enfileirar/tentar de
// novo — o cache de leitura (redisNetWorthCache.ts) trata qualquer erro
// como miss, então "rápido e falho" é sempre melhor que "lento e pendurado"
// pra quem está esperando a resposta de /ranking.
export function createRedisClient(redisUrl: string): Redis {
  return new Redis(redisUrl, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
  })
}
