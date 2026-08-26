import type { GetNetWorthInput, NetWorthReader } from '../../application/useCases/getNetWorth'
import type { NetWorthCacheStore } from '../../application/ports/netWorthCacheStore'
import type { Snapshot } from '../../domain/networth'

// TTL ilustrativo, sujeito a calibração (tarefa 5.7) — "agora" (asOf
// omitido) muda continuamente com o mercado; um baseline passado (asOf
// fixo) não muda nunca depois de calculado, mas usa o mesmo TTL por
// simplicidade (não há necessidade de diferenciar nesta fase).
const DEFAULT_TTL_SECONDS = 5 * 60

function cacheKey(input: GetNetWorthInput): string {
  return `networth:${input.userId}:${input.asOf ? input.asOf.toISOString() : 'current'}`
}

// Decora NetWorthReader com cache de leitura (tarefa 5.7, primeira
// consumidora real do REDIS_URL do backend) — GetRankingUseCase continua
// dependendo só da interface NetWorthReader, sem saber que existe cache
// (mesma injeção de sempre); é a composição em app.ts que decide se injeta
// esta versão ou GetNetWorthUseCase direto.
//
// Chave por (userId, asOf) — não por (window, scope): o escopo Amigos
// (5.9) calcula patrimônio dos mesmos usuários que o escopo Global já
// calculou (só filtra a lista antes), então as duas rotas naturalmente
// compartilham as mesmas entradas de cache por usuário, sem precisar de
// nenhuma chave própria de "grupo de amigos". sandboxAssetIds não entra na
// chave — é o mesmo catálogo (praticamente constante) pra qualquer
// (userId, asOf), reaproveitável em todo cache hit.
export function createRedisNetWorthCache(
  next: NetWorthReader,
  store: NetWorthCacheStore,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): NetWorthReader {
  return {
    async execute(input: GetNetWorthInput): Promise<Snapshot> {
      const key = cacheKey(input)
      const cached = await safeGet(store, key)
      if (cached) return cached

      const snapshot = await next.execute(input)
      await safeSet(store, key, snapshot, ttlSeconds)
      return snapshot
    },
  }
}

// Redis fora do ar (não só "cache frio"/miss) nunca pode derrubar a
// leitura de ranking — o cache é só uma otimização, a fonte da verdade
// continua sendo o motor via `next`. Qualquer erro do store (rede,
// serialização) é tratado como miss/no-op, nunca propagado.
async function safeGet(store: NetWorthCacheStore, key: string): Promise<Snapshot | null> {
  try {
    return await store.get(key)
  } catch {
    return null
  }
}

async function safeSet(
  store: NetWorthCacheStore,
  key: string,
  value: Snapshot,
  ttlSeconds: number,
): Promise<void> {
  try {
    await store.set(key, value, ttlSeconds)
  } catch {
    // best-effort — falha ao popular o cache não é erro de leitura.
  }
}
