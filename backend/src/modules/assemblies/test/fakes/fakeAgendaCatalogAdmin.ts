import type { AgendaCatalogAdmin } from '../../application/ports/agendaCatalogAdmin'
import type { AgendaTemplateAdminView } from '../../domain/agendaTemplates'

export interface FakeAgendaCatalogAdmin extends AgendaCatalogAdmin {
  items: Map<string, AgendaTemplateAdminView>
}

export function createFakeAgendaCatalogAdmin(
  seed: AgendaTemplateAdminView[] = [],
): FakeAgendaCatalogAdmin {
  const fake: FakeAgendaCatalogAdmin = {
    items: new Map(seed.map((t) => [t.key, t])),
    async listAll(kind) {
      return [...fake.items.values()].filter((t) => t.kind === kind)
    },
    async find(kind, key) {
      const found = fake.items.get(key)
      return found && found.kind === kind ? found : null
    },
    async create(kind, key, input) {
      if (fake.items.has(key)) return { status: 'conflict' }
      const template: AgendaTemplateAdminView = {
        ...input,
        key,
        kind,
        active: true,
        createdAt: new Date(0),
        usage: { assemblies: 0, activeProposals: 0 },
      }
      fake.items.set(key, template)
      return { status: 'created', template }
    },
    async update(kind, key, input) {
      const found = await fake.find(kind, key)
      if (!found) return null
      const next = { ...found, ...input }
      fake.items.set(key, next)
      return next
    },
    async setActive(kind, key, active) {
      const found = await fake.find(kind, key)
      if (!found) return null
      const next = { ...found, active }
      fake.items.set(key, next)
      return next
    },
  }
  return fake
}
