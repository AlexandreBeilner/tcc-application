import type { Redis } from 'ioredis'
import type { ScoreboardCache } from '../../application/ports/scoreboardCache'
import type { Scoreboard } from '../../domain/scoreboard'

const keyOf = (assemblyId: string) => `assemblies:scoreboard:${assemblyId}`

// TTL de poucos segundos: é o que faz o placar "ao vivo" sem cada polling reapurar a assembleia.
export function createRedisScoreboardCache(client: Redis, ttlSeconds = 5): ScoreboardCache {
  return {
    async get(assemblyId) {
      try {
        const raw = await client.get(keyOf(assemblyId))
        return raw ? (JSON.parse(raw) as Scoreboard) : null
      } catch {
        // Cache fora do ar não pode derrubar a rota: reapura.
        return null
      }
    },
    async set(assemblyId, scoreboard) {
      try {
        await client.set(keyOf(assemblyId), JSON.stringify(scoreboard), 'EX', ttlSeconds)
      } catch {
        // idem
      }
    },
  }
}
