import type {
  IndicatorHistoryEntry,
  IndicatorHistoryReader,
} from '../../application/ports/indicatorHistoryReader'
import type { IndicatorHistoryCacheStore } from '../../application/ports/indicatorHistoryCacheStore'

// TTL curto (tarefa M.3, mesmo racional de cotação/ranking — tarefa 5.7):
// Selic/IPCA mudam no máximo 1x por dia simulado, e o Temporizador roda no
// máximo 1x por dia real (cron diário, mais gatilho manual do admin) —
// mesmo TTL de redisNetWorthCache.ts por simplicidade, não há necessidade
// de diferenciar nesta fase.
const DEFAULT_TTL_SECONDS = 5 * 60

function cacheKey(days?: number): string {
  return `indicators:history:${days ?? 'default'}`
}

// Decora IndicatorHistoryReader com cache de leitura (tarefa M.3) — chave
// por `days` (não por usuário: a série é a mesma pra qualquer chamador),
// diferente de redisNetWorthCache.ts (chave por userId/asOf).
export function createRedisIndicatorHistoryCache(
  next: IndicatorHistoryReader,
  store: IndicatorHistoryCacheStore,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): IndicatorHistoryReader {
  return {
    async getIndicatorHistory(days?: number): Promise<IndicatorHistoryEntry[]> {
      const key = cacheKey(days)
      const cached = await safeGet(store, key)
      if (cached) return cached

      const history = await next.getIndicatorHistory(days)
      await safeSet(store, key, history, ttlSeconds)
      return history
    },
  }
}

// Redis fora do ar (não só "cache frio"/miss) nunca pode derrubar a
// leitura de indicadores — o cache é só uma otimização, a fonte da
// verdade continua sendo o motor via `next`. Qualquer erro do store
// (rede, serialização) é tratado como miss/no-op, nunca propagado.
async function safeGet(
  store: IndicatorHistoryCacheStore,
  key: string,
): Promise<IndicatorHistoryEntry[] | null> {
  try {
    return await store.get(key)
  } catch {
    return null
  }
}

async function safeSet(
  store: IndicatorHistoryCacheStore,
  key: string,
  value: IndicatorHistoryEntry[],
  ttlSeconds: number,
): Promise<void> {
  try {
    await store.set(key, value, ttlSeconds)
  } catch {
    // best-effort — falha ao popular o cache não é erro de leitura.
  }
}
