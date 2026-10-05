import { sql } from 'drizzle-orm'
import type { Redis } from 'ioredis'
import type { Database } from '../../../../db/client'
import type { HealthProbe } from '../../application/ports/healthProbe'
import type { MarketOverviewReader } from '../../application/ports/marketOverviewReader'

// Liveness do motor (GET /health). Responde mesmo com o banco dele fora.
export function createEngineHealthProbe(engineUrl: string): HealthProbe {
  return {
    async check() {
      const res = await fetch(`${engineUrl}/health`, { signal: AbortSignal.timeout(3000) })
      if (!res.ok) throw new Error(`motor respondeu status ${res.status}`)
    },
  }
}

// Banco de usuário/gamificação: um SELECT 1 no mesmo pool que o resto do backend usa.
export function createDatabaseProbe(db: Database): HealthProbe {
  return {
    async check() {
      await db.execute(sql`select 1`)
    },
  }
}

export function createRedisProbe(redis: Redis): HealthProbe {
  return {
    async check() {
      // O cliente do backend é lazy e sem fila offline (infra/redisClient.ts): o primeiro
      // comando antes de conectar falharia mesmo com o Redis de pé. A sonda conecta antes.
      if (redis.status === 'wait') await redis.connect()
      const reply = await redis.ping()
      if (reply !== 'PONG') throw new Error(`resposta inesperada do Redis: ${reply}`)
    },
  }
}

// O backend não fala com o banco "market": quem fala é o motor. A leitura da
// visão geral do mercado exige esse banco, então se ela responde o banco está de pé.
export function createMarketDatabaseProbe(overview: MarketOverviewReader): HealthProbe {
  return {
    async check() {
      await overview.get()
    },
  }
}
