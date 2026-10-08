import type { AuditLogRepository } from '../../application/ports/auditLogRepository'
import type { ExportSource } from '../../application/ports/exportSource'

// O log é lido pela mesma porta da tela de auditoria. O `payload` já nasce sem dado sensível
// (senha, token, patrimônio absoluto: `RecordAdminActionUseCase`), então sai como JSON em texto.
export function createAuditLogExportSource(auditLog: AuditLogRepository): ExportSource {
  return {
    async fetch(range, limit) {
      const { entries } = await auditLog.list({
        from: range.from,
        to: range.to,
        limit: limit + 1,
        offset: 0,
      })
      return {
        columns: [
          'id',
          'occurred_at',
          'admin_id',
          'admin_username',
          'action',
          'target_type',
          'target_id',
          'result',
          'error_message',
          'payload',
        ],
        rows: entries
          .slice(0, limit)
          .map((e) => [
            e.id,
            e.occurredAt,
            e.adminId,
            e.adminUsername,
            e.action,
            e.targetType,
            e.targetId,
            e.result,
            e.errorMessage,
            JSON.stringify(e.payload),
          ]),
        truncated: entries.length > limit,
      }
    },
  }
}
