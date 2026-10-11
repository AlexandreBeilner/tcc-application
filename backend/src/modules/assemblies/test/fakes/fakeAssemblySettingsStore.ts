import type {
  AssemblySettingsStore,
  StoredAssemblySetting,
} from '../../application/ports/assemblySettingsStore'

export interface FakeAssemblySettingsStore extends AssemblySettingsStore {
  rows: Map<string, StoredAssemblySetting>
}

export function createFakeAssemblySettingsStore(): FakeAssemblySettingsStore {
  const fake: FakeAssemblySettingsStore = {
    rows: new Map(),
    async loadAll() {
      return [...fake.rows.values()]
    },
    async upsert(key, value, adminId, now) {
      fake.rows.set(key, { key, value, updatedBy: adminId, updatedAt: now })
    },
    async remove(key) {
      fake.rows.delete(key)
    },
  }
  return fake
}
