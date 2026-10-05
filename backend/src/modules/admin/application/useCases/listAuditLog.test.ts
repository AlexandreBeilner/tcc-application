import { describe, expect, it } from 'vitest'
import { createFakeAuditLogRepository } from '../../test/fakes/fakeAuditLogRepository'
import { ListAuditLogUseCase } from './listAuditLog'

describe('ListAuditLogUseCase', () => {
  it('devolve as entradas mais recentes primeiro, com o total sem paginação', async () => {
    const auditLog = createFakeAuditLogRepository()
    for (const adminId of ['admin-1', 'admin-2', 'admin-1']) {
      await auditLog.append({
        adminId,
        action: 'tick.trigger',
        targetType: 'tick',
        payload: {},
        result: 'success',
      })
    }
    const useCase = new ListAuditLogUseCase(auditLog)

    const page = await useCase.execute({ limit: 2, offset: 0 })
    expect(page.totalEntries).toBe(3)
    expect(page.entries.map((e) => e.id)).toEqual(['audit-3', 'audit-2'])

    const filtered = await useCase.execute({ adminId: 'admin-1', limit: 10, offset: 0 })
    expect(filtered.totalEntries).toBe(2)
  })
})
