import { describe, expect, it } from 'vitest'
import { IntegrityAlreadyRunningError } from '../../domain/errors'
import { createFakeAuditLogRepository } from '../../test/fakes/fakeAuditLogRepository'
import { createFakeIntegrityAdmin, sampleRun } from '../../test/fakes/fakeIntegrityAdmin'
import { GetIntegrityRunUseCase, StartIntegrityCheckUseCase } from './integrity'
import { RecordAdminActionUseCase } from './recordAdminAction'

function build() {
  const integrityAdmin = createFakeIntegrityAdmin()
  const auditLog = createFakeAuditLogRepository()
  const record = new RecordAdminActionUseCase(auditLog)
  return {
    integrityAdmin,
    auditLog,
    start: new StartIntegrityCheckUseCase(integrityAdmin, record),
    get: new GetIntegrityRunUseCase(integrityAdmin),
  }
}

describe('StartIntegrityCheckUseCase', () => {
  it('abre a verificação no motor e audita integrity.check com o id da verificação', async () => {
    const { start, auditLog } = build()

    const run = await start.execute('admin-1')

    expect(run).toEqual(sampleRun)
    expect(auditLog.entries[0]).toMatchObject({
      adminId: 'admin-1',
      action: 'integrity.check',
      targetType: 'integrity_check',
      targetId: 'run-1',
      result: 'success',
    })
  })

  it('já em andamento: relança o erro e audita a falha', async () => {
    const { start, integrityAdmin, auditLog } = build()
    await start.execute('admin-1')
    expect(integrityAdmin.running).toBe(true)

    await expect(start.execute('admin-1')).rejects.toBeInstanceOf(IntegrityAlreadyRunningError)
    expect(auditLog.entries[1]).toMatchObject({ action: 'integrity.check', result: 'failed' })
  })
})

describe('GetIntegrityRunUseCase', () => {
  it('devolve null se nenhuma verificação rodou e a última depois de uma', async () => {
    const { get, start } = build()
    expect(await get.execute()).toBeNull()
    await start.execute('admin-1')
    expect(await get.execute()).toEqual(sampleRun)
  })
})
