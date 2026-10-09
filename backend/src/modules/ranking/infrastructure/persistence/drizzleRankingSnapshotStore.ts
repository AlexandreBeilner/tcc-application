import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, lt } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { rankingSnapshots } from '../../../../db/schema'
import type {
  RankingSnapshotRead,
  RankingSnapshotStore,
} from '../../application/ports/rankingSnapshotStore'
import type { RankingCriterion } from '../../domain/ranking'
import type { WindowKind } from '../../domain/window'

// Tamanho do lote de INSERT (limite de parâmetros do Postgres: 11 colunas por linha).
const INSERT_BATCH_SIZE = 1000

export function createDrizzleRankingSnapshotStore(db: Database): RankingSnapshotStore {
  return {
    // A rodada inteira entra numa transação: a leitura nunca vê uma rodada pela metade.
    async saveRun(run) {
      const runId = randomUUID()
      const rows = run.groups.flatMap((group) =>
        group.entries.map((entry, index) => ({
          runId,
          computedAt: run.computedAt,
          windowKind: group.window ?? 'none',
          criterion: group.criterion,
          userId: entry.userId,
          position: index + 1,
          username: entry.username,
          level: entry.level,
          xp: entry.xp,
          profitabilityPct: entry.profitabilityPct,
          sortKey: entry.sortKey,
        })),
      )
      await db.transaction(async (tx) => {
        for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
          await tx.insert(rankingSnapshots).values(rows.slice(i, i + INSERT_BATCH_SIZE))
        }
      })
    },

    async readLatest(
      criterion: RankingCriterion,
      window: WindowKind | null,
    ): Promise<RankingSnapshotRead | null> {
      const [latest] = await db
        .select({ runId: rankingSnapshots.runId, computedAt: rankingSnapshots.computedAt })
        .from(rankingSnapshots)
        .orderBy(desc(rankingSnapshots.computedAt))
        .limit(1)
      if (!latest) return null

      const rows = await db
        .select()
        .from(rankingSnapshots)
        .where(
          and(
            eq(rankingSnapshots.runId, latest.runId),
            eq(rankingSnapshots.windowKind, window ?? 'none'),
            eq(rankingSnapshots.criterion, criterion),
          ),
        )
        .orderBy(asc(rankingSnapshots.position))

      return {
        computedAt: latest.computedAt,
        entries: rows.map((row) => ({
          userId: row.userId,
          username: row.username,
          level: row.level,
          xp: row.xp,
          profitabilityPct: row.profitabilityPct,
          sortKey: row.sortKey,
        })),
      }
    },

    async deleteRunsBefore(cutoff) {
      await db.delete(rankingSnapshots).where(lt(rankingSnapshots.computedAt, cutoff))
    },
  }
}
