import { and, desc, eq, gt, isNull, lte, or } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { announcements } from '../../../../db/schema'
import type { AnnouncementRepository } from '../../application/ports/announcementRepository'
import type {
  Announcement,
  AnnouncementKind,
  AnnouncementSeverity,
} from '../../domain/announcement'

type Row = typeof announcements.$inferSelect

function toAnnouncement(row: Row): Announcement {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    // As colunas são texto com CHECK no banco; a lista fechada é garantida na escrita.
    severity: row.severity as AnnouncementSeverity,
    kind: row.kind as AnnouncementKind,
    dismissible: row.dismissible,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    linkedHaltId: row.linkedHaltId,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  }
}

export function createDrizzleAnnouncementRepository(db: Database): AnnouncementRepository {
  return {
    async listActive(now) {
      const rows = await db
        .select()
        .from(announcements)
        .where(
          and(
            lte(announcements.startsAt, now),
            or(isNull(announcements.endsAt), gt(announcements.endsAt, now)),
          ),
        )
      return rows.map(toAnnouncement)
    },

    async listAll(limit) {
      const rows = await db
        .select()
        .from(announcements)
        .orderBy(desc(announcements.createdAt), desc(announcements.id))
        .limit(limit)
      return rows.map(toAnnouncement)
    },

    async findById(id) {
      const [row] = await db.select().from(announcements).where(eq(announcements.id, id)).limit(1)
      return row ? toAnnouncement(row) : null
    },

    async findOpenMaintenance(now) {
      const [row] = await db
        .select()
        .from(announcements)
        .where(
          and(
            eq(announcements.kind, 'maintenance'),
            or(isNull(announcements.endsAt), gt(announcements.endsAt, now)),
          ),
        )
        .limit(1)
      return row ? toAnnouncement(row) : null
    },

    async create(input) {
      const [row] = await db
        .insert(announcements)
        .values({
          title: input.title,
          body: input.body,
          severity: input.severity,
          kind: input.kind,
          dismissible: input.dismissible,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          linkedHaltId: input.linkedHaltId ?? null,
          createdBy: input.createdBy,
        })
        .returning()
      return toAnnouncement(row!)
    },

    async update(id, draft) {
      const [row] = await db
        .update(announcements)
        .set({
          title: draft.title,
          body: draft.body,
          severity: draft.severity,
          dismissible: draft.dismissible,
          startsAt: draft.startsAt,
          endsAt: draft.endsAt,
        })
        .where(eq(announcements.id, id))
        .returning()
      return row ? toAnnouncement(row) : null
    },

    async setEnd(id, endsAt) {
      const [row] = await db
        .update(announcements)
        .set({ endsAt })
        .where(eq(announcements.id, id))
        .returning()
      return row ? toAnnouncement(row) : null
    },

    async remove(id) {
      await db.delete(announcements).where(eq(announcements.id, id))
    },
  }
}
