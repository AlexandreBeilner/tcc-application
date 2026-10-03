import type { AdminAuditEntry } from '../../domain/auditEntry'
import type {
  AuditLogRepository,
  NewAdminAuditEntry,
} from '../../application/ports/auditLogRepository'

export interface FakeAuditLogRepository extends AuditLogRepository {
  entries: AdminAuditEntry[]
  appendError?: Error
}

export function createFakeAuditLogRepository(): FakeAuditLogRepository {
  const fake: FakeAuditLogRepository = {
    entries: [],
    appendError: undefined,
    async append(entry: NewAdminAuditEntry) {
      if (fake.appendError) {
        throw fake.appendError
      }
      fake.entries.push({
        ...entry,
        id: `audit-${fake.entries.length + 1}`,
        occurredAt: new Date('2026-10-03T12:00:00.000Z'),
      })
    },
    async list(query) {
      const filtered = [...fake.entries]
        .reverse() // mais recente primeiro, como o adapter real
        .filter((e) => !query.adminId || e.adminId === query.adminId)
        .filter((e) => !query.action || e.action === query.action)
        .filter((e) => !query.targetType || e.targetType === query.targetType)
        .filter((e) => !query.targetId || e.targetId === query.targetId)
        .filter((e) => !query.result || e.result === query.result)
        .filter((e) => !query.from || e.occurredAt >= query.from)
        .filter((e) => !query.to || e.occurredAt <= query.to)
      return {
        entries: filtered.slice(query.offset, query.offset + query.limit),
        totalEntries: filtered.length,
      }
    },
  }
  return fake
}
