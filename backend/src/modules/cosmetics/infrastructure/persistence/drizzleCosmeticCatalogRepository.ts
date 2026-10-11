import { asc, eq } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { cosmeticItems } from '../../../../db/schema'
import type { CosmeticCatalogRepository } from '../../application/ports/cosmeticCatalogRepository'
import type { CosmeticKind } from '../../domain/cosmetic'

export function createDrizzleCosmeticCatalogRepository(db: Database): CosmeticCatalogRepository {
  return {
    async listActive() {
      const rows = await db
        .select()
        .from(cosmeticItems)
        .where(eq(cosmeticItems.active, true))
        .orderBy(asc(cosmeticItems.kind), asc(cosmeticItems.sortOrder), asc(cosmeticItems.key))
      return rows.map((row) => ({
        key: row.key,
        kind: row.kind as CosmeticKind,
        name: row.name,
        description: row.description,
        sortOrder: row.sortOrder,
        unlockReferrals: row.unlockReferrals,
      }))
    },
  }
}
