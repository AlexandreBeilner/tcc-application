import { describe, expect, it } from 'vitest'
import { createFakeAuditLogRepository } from '../../test/fakes/fakeAuditLogRepository'
import { createAuditLogAdminSessionAuditor } from './auditLogAdminSessionAuditor'

describe('auditLogAdminSessionAuditor', () => {
  it('grava login bem-sucedido e falho com a ação certa', async () => {
    const auditLog = createFakeAuditLogRepository()
    const auditor = createAuditLogAdminSessionAuditor(auditLog)

    await auditor.record({ adminId: 'a1', kind: 'login' })
    await auditor.record({ adminId: 'a1', kind: 'reauth_failed' })
    await auditor.record({ adminId: 'a1', kind: 'password_reset_denied' })

    const { entries } = await auditLog.list({ limit: 10, offset: 0 })
    expect(entries.map((e) => [e.action, e.result])).toEqual(
      expect.arrayContaining([
        ['admin.login', 'success'],
        ['admin.reauth_failed', 'failed'],
        ['admin.password_reset_denied', 'failed'],
      ]),
    )
  })

  it('engole falha do repositório', async () => {
    const auditor = createAuditLogAdminSessionAuditor({
      async append() {
        throw new Error('banco fora')
      },
      async list() {
        return { entries: [], totalEntries: 0 }
      },
    })
    await expect(auditor.record({ adminId: 'a1', kind: 'login' })).resolves.toBeUndefined()
  })
})
