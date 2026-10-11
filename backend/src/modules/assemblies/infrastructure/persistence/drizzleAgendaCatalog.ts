import { and, asc, eq } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { agendaTemplates } from '../../../../db/schema'
import type { AgendaCatalog } from '../../application/ports/agendaCatalog'
import type { AgendaTemplate, TemplatePurpose } from '../../domain/lifecycle'

export function createDrizzleAgendaCatalog(db: Database): AgendaCatalog {
  return {
    async listActive(kind) {
      const rows = await db
        .select()
        .from(agendaTemplates)
        .where(and(eq(agendaTemplates.kind, kind), eq(agendaTemplates.active, true)))
        .orderBy(asc(agendaTemplates.key))
      return rows.map((row): AgendaTemplate => ({
        key: row.key,
        kind: row.kind,
        sector: row.sector,
        title: row.title,
        description: row.description,
        purpose: row.purpose as TemplatePurpose,
        options: row.options as AgendaTemplate['options'],
      }))
    },
  }
}
