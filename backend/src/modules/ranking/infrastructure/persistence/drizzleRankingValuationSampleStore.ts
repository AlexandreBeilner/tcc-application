import { and, asc, gte, lt, lte } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { rankingValuationSamples } from '../../../../db/schema'
import type { RankingValuationSampleStore } from '../../application/ports/rankingValuationSampleStore'
import type { Snapshot } from '../../domain/networth'

// Limite de parâmetros do Postgres: 3 colunas por linha.
const INSERT_BATCH_SIZE = 1000

export function createDrizzleRankingValuationSampleStore(
  db: Database,
): RankingValuationSampleStore {
  return {
    async saveSamples(computedAt, samples) {
      await db.transaction(async (tx) => {
        for (let i = 0; i < samples.length; i += INSERT_BATCH_SIZE) {
          await tx.insert(rankingValuationSamples).values(
            samples.slice(i, i + INSERT_BATCH_SIZE).map((sample) => ({
              computedAt,
              userId: sample.userId,
              snapshot: sample.snapshot as unknown as Record<string, unknown>,
            })),
          )
        }
      })
    },

    // A tabela só guarda rodadas perto de começo de janela, então esta faixa tem poucas linhas
    // por usuário; a mais antiga de cada um vence.
    async findBaselines(notBefore, notAfter) {
      const rows = await db
        .select()
        .from(rankingValuationSamples)
        .where(
          and(
            gte(rankingValuationSamples.computedAt, notBefore),
            lte(rankingValuationSamples.computedAt, notAfter),
          ),
        )
        .orderBy(asc(rankingValuationSamples.computedAt))
      const result = new Map<string, Snapshot>()
      for (const row of rows) {
        if (!result.has(row.userId)) result.set(row.userId, row.snapshot as unknown as Snapshot)
      }
      return result
    },

    async deleteSamplesBefore(cutoff) {
      await db.delete(rankingValuationSamples).where(lt(rankingValuationSamples.computedAt, cutoff))
    },
  }
}
