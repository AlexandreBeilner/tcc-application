import { and, count, desc, eq, gte, lte } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { adminAuditLog, users } from '../../../../db/schema'
import type { AuditLogRepository } from '../../application/ports/auditLogRepository'
import type { AdminAuditAction, AdminAuditResult } from '../../domain/auditEntry'

export function createDrizzleAuditLogRepository(db: Database): AuditLogRepository {
  return {
    async append(entry) {
      await db.insert(adminAuditLog).values({
        adminId: entry.adminId,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId ?? null,
        payload: entry.payload,
        result: entry.result,
        errorMessage: entry.errorMessage ?? null,
      })
    },

    async list(query) {
      const filters: SQL[] = []
      if (query.adminId) filters.push(eq(adminAuditLog.adminId, query.adminId))
      if (query.action) filters.push(eq(adminAuditLog.action, query.action))
      if (query.targetType) filters.push(eq(adminAuditLog.targetType, query.targetType))
      if (query.targetId) filters.push(eq(adminAuditLog.targetId, query.targetId))
      if (query.result) filters.push(eq(adminAuditLog.result, query.result))
      if (query.from) filters.push(gte(adminAuditLog.occurredAt, query.from))
      if (query.to) filters.push(lte(adminAuditLog.occurredAt, query.to))
      const where = filters.length > 0 ? and(...filters) : undefined

      const rows = await db
        .select({ log: adminAuditLog, adminUsername: users.username })
        .from(adminAuditLog)
        .innerJoin(users, eq(users.id, adminAuditLog.adminId))
        .where(where)
        .orderBy(desc(adminAuditLog.occurredAt), desc(adminAuditLog.id))
        .limit(query.limit)
        .offset(query.offset)

      const [{ total }] = await db.select({ total: count() }).from(adminAuditLog).where(where)

      return {
        entries: rows.map(({ log, adminUsername }) => ({
          id: log.id,
          adminId: log.adminId,
          adminUsername,
          // O banco guarda texto; a lista fechada é garantida na escrita
          // (`append` só recebe `AdminAuditAction`), então o cast é seguro.
          action: log.action as AdminAuditAction,
          targetType: log.targetType,
          targetId: log.targetId ?? undefined,
          payload: log.payload,
          result: log.result as AdminAuditResult,
          errorMessage: log.errorMessage ?? undefined,
          occurredAt: log.occurredAt,
        })),
        totalEntries: total,
      }
    },
  }
}
