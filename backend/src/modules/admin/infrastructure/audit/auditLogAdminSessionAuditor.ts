import type {
  AdminSessionAuditor,
  AdminSessionEventKind,
} from '../../../auth/application/ports/adminSessionAuditor'
import type { AdminAuditAction } from '../../domain/auditEntry'
import type { AuditLogRepository } from '../../application/ports/auditLogRepository'

const ACTION_BY_KIND: Record<AdminSessionEventKind, AdminAuditAction> = {
  login: 'admin.login',
  login_failed: 'admin.login_failed',
  reauth: 'admin.reauth',
  reauth_failed: 'admin.reauth_failed',
}

// Liga a porta do `auth` ao log de auditoria do `admin` (N.22). Falha ao
// gravar é só registrada: o login do administrador não pode depender do log.
export function createAuditLogAdminSessionAuditor(
  auditLog: AuditLogRepository,
): AdminSessionAuditor {
  return {
    async record({ adminId, kind }) {
      try {
        await auditLog.append({
          adminId,
          action: ACTION_BY_KIND[kind],
          targetType: 'session',
          targetId: adminId,
          payload: {},
          result: kind.endsWith('_failed') ? 'failed' : 'success',
          errorMessage: kind.endsWith('_failed') ? 'senha incorreta' : undefined,
        })
      } catch (err) {
        console.error('[audit] falha ao gravar sessão de admin', kind, err)
      }
    },
  }
}
