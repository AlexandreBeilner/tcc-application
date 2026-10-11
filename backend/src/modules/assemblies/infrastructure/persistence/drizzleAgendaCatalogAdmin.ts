import { and, asc, eq, sql } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { agendaProposals, agendaTemplates, assemblies } from '../../../../db/schema'
import type { AgendaCatalogAdmin } from '../../application/ports/agendaCatalogAdmin'
import type {
  AgendaTemplateAdminView,
  AgendaTemplateOptionInput,
} from '../../domain/agendaTemplates'
import type { TemplatePurpose } from '../../domain/lifecycle'

function toView(
  row: typeof agendaTemplates.$inferSelect,
  usage: AgendaTemplateAdminView['usage'],
): AgendaTemplateAdminView {
  return {
    key: row.key,
    kind: row.kind,
    purpose: row.purpose as TemplatePurpose,
    sector: row.sector,
    title: row.title,
    description: row.description,
    options: row.options as AgendaTemplateOptionInput[],
    active: row.active,
    createdAt: row.createdAt,
    usage,
  }
}

export function createDrizzleAgendaCatalogAdmin(db: Database): AgendaCatalogAdmin {
  async function usageOf(kind: string, key: string): Promise<AgendaTemplateAdminView['usage']> {
    const [assembliesCount] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(assemblies)
      .where(and(eq(assemblies.kind, kind), eq(assemblies.templateKey, key)))
    const [proposalsCount] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(agendaProposals)
      .where(
        and(
          eq(agendaProposals.kind, kind),
          eq(agendaProposals.templateKey, key),
          eq(agendaProposals.status, 'active'),
        ),
      )
    return { assemblies: assembliesCount?.n ?? 0, activeProposals: proposalsCount?.n ?? 0 }
  }

  async function load(kind: string, key: string): Promise<AgendaTemplateAdminView | null> {
    const [row] = await db
      .select()
      .from(agendaTemplates)
      .where(and(eq(agendaTemplates.kind, kind), eq(agendaTemplates.key, key)))
    return row ? toView(row, await usageOf(kind, key)) : null
  }

  return {
    async listAll(kind) {
      const [rows, assemblyCounts, proposalCounts] = await Promise.all([
        db
          .select()
          .from(agendaTemplates)
          .where(eq(agendaTemplates.kind, kind))
          .orderBy(asc(agendaTemplates.key)),
        db
          .select({ key: assemblies.templateKey, n: sql<number>`count(*)::int` })
          .from(assemblies)
          .where(eq(assemblies.kind, kind))
          .groupBy(assemblies.templateKey),
        db
          .select({ key: agendaProposals.templateKey, n: sql<number>`count(*)::int` })
          .from(agendaProposals)
          .where(and(eq(agendaProposals.kind, kind), eq(agendaProposals.status, 'active')))
          .groupBy(agendaProposals.templateKey),
      ])
      const byAssembly = new Map(assemblyCounts.map((r) => [r.key, r.n]))
      const byProposal = new Map(proposalCounts.map((r) => [r.key, r.n]))
      return rows.map((row) =>
        toView(row, {
          assemblies: byAssembly.get(row.key) ?? 0,
          activeProposals: byProposal.get(row.key) ?? 0,
        }),
      )
    },
    find: load,
    async create(kind, key, input) {
      const [row] = await db
        .insert(agendaTemplates)
        .values({
          key,
          kind,
          purpose: input.purpose ?? 'general',
          sector: input.sector,
          title: input.title,
          description: input.description,
          options: input.options,
        })
        .onConflictDoNothing({ target: agendaTemplates.key })
        .returning()
      return row
        ? { status: 'created', template: toView(row, { assemblies: 0, activeProposals: 0 }) }
        : { status: 'conflict' }
    },
    async update(kind, key, input) {
      const [row] = await db
        .update(agendaTemplates)
        .set({
          purpose: input.purpose ?? 'general',
          sector: input.sector,
          title: input.title,
          description: input.description,
          options: input.options,
        })
        .where(and(eq(agendaTemplates.kind, kind), eq(agendaTemplates.key, key)))
        .returning({ key: agendaTemplates.key })
      return row ? load(kind, key) : null
    },
    async setActive(kind, key, active) {
      const [row] = await db
        .update(agendaTemplates)
        .set({ active })
        .where(and(eq(agendaTemplates.kind, kind), eq(agendaTemplates.key, key)))
        .returning({ key: agendaTemplates.key })
      return row ? load(kind, key) : null
    },
  }
}
