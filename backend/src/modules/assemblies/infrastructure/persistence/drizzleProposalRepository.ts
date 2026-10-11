import { and, eq, gt, gte, lt, lte, sql } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { agendaProposals, agendaProposalSupports } from '../../../../db/schema'
import type { ProposalRepository } from '../../application/ports/proposalRepository'
import type { AgendaProposal, ProposalStatus } from '../../domain/proposals'

type Row = typeof agendaProposals.$inferSelect

function toProposal(row: Row, supportCount: number, supportedByMe: boolean): AgendaProposal {
  return {
    id: row.id,
    kind: row.kind,
    subjectRef: row.subjectRef,
    templateKey: row.templateKey,
    proposedBy: row.proposedBy,
    status: row.status as ProposalStatus,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    supportCount,
    supportedByMe,
  }
}

export function createDrizzleProposalRepository(db: Database): ProposalRepository {
  // Contagem de apoios e "eu apoio" de uma proposta (ou de todas as de uma consulta) por subselect.
  const supportCountSql = sql<number>`(SELECT count(*)::int FROM ${agendaProposalSupports} WHERE ${agendaProposalSupports.proposalId} = ${agendaProposals.id})`
  const supportedBySql = (viewerId?: string) =>
    viewerId
      ? sql<boolean>`EXISTS (SELECT 1 FROM ${agendaProposalSupports} WHERE ${agendaProposalSupports.proposalId} = ${agendaProposals.id} AND ${agendaProposalSupports.userId} = ${viewerId})`
      : sql<boolean>`false`

  return {
    async propose(input) {
      return db.transaction(async (tx) => {
        // Serializa a pauta da empresa (duplicado) e depois a pessoa no mês (teto), sempre nesta
        // ordem para dois pedidos nunca se travarem um ao outro.
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(hashtext(${`proposal:${input.kind}:${input.subjectRef}:${input.templateKey}`}))`,
        )
        await tx
          .update(agendaProposals)
          .set({ status: 'expired' })
          .where(
            and(
              eq(agendaProposals.kind, input.kind),
              eq(agendaProposals.subjectRef, input.subjectRef),
              eq(agendaProposals.templateKey, input.templateKey),
              eq(agendaProposals.status, 'active'),
              lte(agendaProposals.expiresAt, input.now),
            ),
          )
        const [existing] = await tx
          .select()
          .from(agendaProposals)
          .where(
            and(
              eq(agendaProposals.kind, input.kind),
              eq(agendaProposals.subjectRef, input.subjectRef),
              eq(agendaProposals.templateKey, input.templateKey),
              eq(agendaProposals.status, 'active'),
            ),
          )
        if (existing) {
          const [{ total }] = await tx
            .select({ total: sql<number>`count(*)::int` })
            .from(agendaProposalSupports)
            .where(eq(agendaProposalSupports.proposalId, existing.id))
          return { status: 'existing' as const, proposal: toProposal(existing, total, false) }
        }

        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(hashtext(${`proposal-cap:${input.userId}`}))`,
        )
        const [{ used }] = await tx
          .select({ used: sql<number>`count(*)::int` })
          .from(agendaProposals)
          .where(
            and(
              eq(agendaProposals.proposedBy, input.userId),
              gte(agendaProposals.createdAt, input.monthFrom),
              lt(agendaProposals.createdAt, input.monthTo),
            ),
          )
        if (used >= input.monthlyCap) return { status: 'cap_reached' as const }

        const [row] = await tx
          .insert(agendaProposals)
          .values({
            kind: input.kind,
            subjectRef: input.subjectRef,
            templateKey: input.templateKey,
            proposedBy: input.userId,
            createdAt: input.now,
            expiresAt: input.expiresAt,
          })
          .returning()
        await tx
          .insert(agendaProposalSupports)
          .values({ proposalId: row.id, userId: input.userId, createdAt: input.now })
        return { status: 'created' as const, proposal: toProposal(row, 1, true) }
      })
    },
    async findById(id, viewerId) {
      const [row] = await db
        .select({
          row: agendaProposals,
          supportCount: supportCountSql,
          supportedByMe: supportedBySql(viewerId),
        })
        .from(agendaProposals)
        .where(eq(agendaProposals.id, id))
      return row ? toProposal(row.row, row.supportCount, row.supportedByMe) : null
    },
    async addSupport(proposalId, userId, now) {
      return db.transaction(async (tx) => {
        // Trava a proposta: o consumo/expiração e o apoio se serializam.
        const [row] = await tx
          .select({ status: agendaProposals.status, expiresAt: agendaProposals.expiresAt })
          .from(agendaProposals)
          .where(eq(agendaProposals.id, proposalId))
          .for('update')
        if (!row || row.status !== 'active' || row.expiresAt <= now) return 'not_active' as const
        const inserted = await tx
          .insert(agendaProposalSupports)
          .values({ proposalId, userId, createdAt: now })
          .onConflictDoNothing()
          .returning({ userId: agendaProposalSupports.userId })
        return inserted.length > 0 ? ('added' as const) : ('already' as const)
      })
    },
    async removeSupport(proposalId, userId) {
      const rows = await db
        .delete(agendaProposalSupports)
        .where(
          and(
            eq(agendaProposalSupports.proposalId, proposalId),
            eq(agendaProposalSupports.userId, userId),
          ),
        )
        .returning({ userId: agendaProposalSupports.userId })
      return rows.length > 0
    },
    async listActive(kind, subjectRef, now, viewerId) {
      const rows = await db
        .select({
          row: agendaProposals,
          supportCount: supportCountSql,
          supportedByMe: supportedBySql(viewerId),
        })
        .from(agendaProposals)
        .where(
          and(
            eq(agendaProposals.kind, kind),
            eq(agendaProposals.subjectRef, subjectRef),
            eq(agendaProposals.status, 'active'),
            gt(agendaProposals.expiresAt, now),
          ),
        )
      return rows.map((r) => toProposal(r.row, r.supportCount, r.supportedByMe))
    },
    async countProposedBy(userId, from, to) {
      const [{ total }] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(agendaProposals)
        .where(
          and(
            eq(agendaProposals.proposedBy, userId),
            gte(agendaProposals.createdAt, from),
            lt(agendaProposals.createdAt, to),
          ),
        )
      return total
    },
    async consumeActive(kind, subjectRef, templateKey, assemblyId) {
      const rows = await db
        .update(agendaProposals)
        .set({ status: 'consumed', consumedAssemblyId: assemblyId })
        .where(
          and(
            eq(agendaProposals.kind, kind),
            eq(agendaProposals.subjectRef, subjectRef),
            eq(agendaProposals.templateKey, templateKey),
            eq(agendaProposals.status, 'active'),
          ),
        )
        .returning({ id: agendaProposals.id })
      return rows.length > 0
    },
    async expireDue(now) {
      const rows = await db
        .update(agendaProposals)
        .set({ status: 'expired' })
        .where(and(eq(agendaProposals.status, 'active'), lte(agendaProposals.expiresAt, now)))
        .returning({ id: agendaProposals.id })
      return rows.length
    },
  }
}
