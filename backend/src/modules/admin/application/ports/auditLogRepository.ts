import type { AdminAuditAction, AdminAuditEntry, AdminAuditResult } from '../../domain/auditEntry'

export type NewAdminAuditEntry = Omit<AdminAuditEntry, 'id' | 'adminUsername' | 'occurredAt'>

export interface ListAuditLogQuery {
  adminId?: string
  action?: AdminAuditAction
  result?: AdminAuditResult
  from?: Date
  to?: Date
  limit: number
  offset: number
}

export interface ListAuditLogResult {
  entries: AdminAuditEntry[]
  totalEntries: number
}

// Log append-only: a port só sabe acrescentar e consultar. Imutabilidade é
// garantida também no banco (trigger, ver migration), não só pela ausência
// de método de update/delete aqui.
export interface AuditLogRepository {
  append(entry: NewAdminAuditEntry): Promise<void>
  list(query: ListAuditLogQuery): Promise<ListAuditLogResult>
}
