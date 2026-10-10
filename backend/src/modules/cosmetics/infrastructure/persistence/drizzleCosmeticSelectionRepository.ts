import { and, eq, inArray } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { userCosmetics } from '../../../../db/schema'
import type { CosmeticSelectionRepository } from '../../application/ports/cosmeticSelectionRepository'
import type { CosmeticSelection } from '../../domain/cosmetic'

type Row = { userId: string; kind: string; itemKey: string }

function fold(rows: Row[]): CosmeticSelection {
  const selection: CosmeticSelection = { frame: null, title: null }
  for (const row of rows) {
    if (row.kind === 'frame') selection.frame = row.itemKey
    if (row.kind === 'title') selection.title = row.itemKey
  }
  return selection
}

export function createDrizzleCosmeticSelectionRepository(
  db: Database,
): CosmeticSelectionRepository {
  return {
    async find(userId) {
      const rows = await db.select().from(userCosmetics).where(eq(userCosmetics.userId, userId))
      return fold(rows)
    },

    async findMany(userIds) {
      const result = new Map<string, CosmeticSelection>()
      if (userIds.length === 0) return result
      const rows = await db
        .select()
        .from(userCosmetics)
        .where(inArray(userCosmetics.userId, userIds))
      const byUser = new Map<string, Row[]>()
      for (const row of rows) byUser.set(row.userId, [...(byUser.get(row.userId) ?? []), row])
      for (const [id, userRows] of byUser) result.set(id, fold(userRows))
      return result
    },

    async equip(userId, kind, itemKey) {
      await db
        .insert(userCosmetics)
        .values({ userId, kind, itemKey })
        .onConflictDoUpdate({
          target: [userCosmetics.userId, userCosmetics.kind],
          set: { itemKey, equippedAt: new Date() },
        })
    },

    async unequip(userId, kind) {
      await db
        .delete(userCosmetics)
        .where(and(eq(userCosmetics.userId, userId), eq(userCosmetics.kind, kind)))
    },
  }
}
