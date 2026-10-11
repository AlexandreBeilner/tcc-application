import { eq } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { assemblySettings } from '../../../../db/schema'
import type { AssemblySettingsStore } from '../../application/ports/assemblySettingsStore'

export function createDrizzleAssemblySettingsStore(db: Database): AssemblySettingsStore {
  return {
    async loadAll() {
      const rows = await db.select().from(assemblySettings)
      return rows.map((r) => ({
        key: r.key,
        value: r.value,
        updatedBy: r.updatedBy,
        updatedAt: r.updatedAt,
      }))
    },
    async upsert(key, value, adminId, now) {
      await db
        .insert(assemblySettings)
        .values({ key, value, updatedBy: adminId, updatedAt: now })
        .onConflictDoUpdate({
          target: assemblySettings.key,
          set: { value, updatedBy: adminId, updatedAt: now },
        })
    },
    async remove(key) {
      await db.delete(assemblySettings).where(eq(assemblySettings.key, key))
    },
  }
}
