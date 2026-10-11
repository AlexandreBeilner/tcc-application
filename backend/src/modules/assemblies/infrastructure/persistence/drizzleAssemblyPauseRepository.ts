import { and, desc, eq, isNull } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { assemblyPauses } from '../../../../db/schema'
import type { AssemblyPauseRepository } from '../../application/ports/assemblyPauseRepository'
import { scopeKeyOf, type AssemblyPause, type PauseScope } from '../../domain/pause'

function toPause(row: typeof assemblyPauses.$inferSelect): AssemblyPause {
  return {
    id: row.id,
    scope: row.scope as PauseScope,
    kind: row.kind,
    subjectRef: row.subjectRef,
    reason: row.reason,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    liftedAt: row.liftedAt,
    liftedBy: row.liftedBy,
  }
}

export function createDrizzleAssemblyPauseRepository(db: Database): AssemblyPauseRepository {
  return {
    async listActive() {
      const rows = await db
        .select()
        .from(assemblyPauses)
        .where(isNull(assemblyPauses.liftedAt))
        .orderBy(desc(assemblyPauses.createdAt))
      return rows.map(toPause)
    },
    async listRecent(limit) {
      const rows = await db
        .select()
        .from(assemblyPauses)
        .orderBy(desc(assemblyPauses.createdAt))
        .limit(limit)
      return rows.map(toPause)
    },
    async create(input, adminId, now) {
      // O índice único parcial (uma pausa vigente por escopo) decide a corrida entre dois admins.
      const [row] = await db
        .insert(assemblyPauses)
        .values({
          scope: input.scope,
          kind: input.kind,
          subjectRef: input.subjectRef,
          scopeKey: scopeKeyOf(input.scope, input.kind, input.subjectRef),
          reason: input.reason,
          createdBy: adminId,
          createdAt: now,
        })
        .onConflictDoNothing()
        .returning()
      return row ? { status: 'created', pause: toPause(row) } : { status: 'conflict' }
    },
    async lift(id, adminId, now) {
      // Condicional ao estado: duas retomadas simultâneas só vencem uma.
      const [lifted] = await db
        .update(assemblyPauses)
        .set({ liftedAt: now, liftedBy: adminId })
        .where(and(eq(assemblyPauses.id, id), isNull(assemblyPauses.liftedAt)))
        .returning()
      if (lifted) return { status: 'lifted', pause: toPause(lifted) }
      const [existing] = await db
        .select({ id: assemblyPauses.id })
        .from(assemblyPauses)
        .where(eq(assemblyPauses.id, id))
      return { status: existing ? 'already_lifted' : 'not_found' }
    },
  }
}
