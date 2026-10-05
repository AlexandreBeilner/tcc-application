import type {
  AuditLogRepository,
  ListAuditLogQuery,
  ListAuditLogResult,
} from '../ports/auditLogRepository'

// Delegação fina, mesmo padrão de ListMacroEventsUseCase: a consulta é só
// leitura do log; a regra (quem pode ver) é o `requireRole('admin')` do router.
export class ListAuditLogUseCase {
  constructor(private readonly auditLog: AuditLogRepository) {}

  async execute(query: ListAuditLogQuery): Promise<ListAuditLogResult> {
    return this.auditLog.list(query)
  }
}
