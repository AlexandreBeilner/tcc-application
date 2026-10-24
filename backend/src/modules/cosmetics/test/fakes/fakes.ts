import type { CosmeticCatalogRepository } from '../../application/ports/cosmeticCatalogRepository'
import type { CosmeticSelectionRepository } from '../../application/ports/cosmeticSelectionRepository'
import type { CosmeticItem, CosmeticSelection } from '../../domain/cosmetic'

export const TEST_CATALOG: CosmeticItem[] = [
  { key: 'frame_aurora', kind: 'frame', name: 'Aurora', description: 'a', sortOrder: 10 },
  { key: 'frame_oceano', kind: 'frame', name: 'Oceano', description: 'b', sortOrder: 20 },
  {
    key: 'title_paciente',
    kind: 'title',
    name: 'Investidor Paciente',
    description: 'c',
    sortOrder: 10,
  },
]

export function createFakeCatalog(items: CosmeticItem[] = TEST_CATALOG): CosmeticCatalogRepository {
  return { listActive: async () => items }
}

export interface FakeSelections extends CosmeticSelectionRepository {
  rows: Map<string, CosmeticSelection>
}

export function createFakeSelections(
  initial: Record<string, CosmeticSelection> = {},
): FakeSelections {
  const rows = new Map(Object.entries(initial))
  return {
    rows,
    async find(userId) {
      return rows.get(userId) ?? { frame: null, title: null }
    },
    async findMany(userIds) {
      return new Map(userIds.flatMap((id) => (rows.has(id) ? [[id, rows.get(id)!] as const] : [])))
    },
    async equip(userId, kind, itemKey) {
      rows.set(userId, { ...(rows.get(userId) ?? { frame: null, title: null }), [kind]: itemKey })
    },
    async unequip(userId, kind) {
      rows.set(userId, { ...(rows.get(userId) ?? { frame: null, title: null }), [kind]: null })
    },
  }
}
