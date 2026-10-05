import { describe, expect, it } from 'vitest'
import { SchedulerDisabledError } from '../../domain/errors'
import { createFakeAuditLogRepository } from '../../test/fakes/fakeAuditLogRepository'
import { createFakeSchedulerAdmin } from '../../test/fakes/fakeSchedulerAdmin'
import { RecordAdminActionUseCase } from './recordAdminAction'
import { SetSchedulerPausedUseCase } from './setSchedulerPaused'

function build() {
  const schedulerAdmin = createFakeSchedulerAdmin()
  const auditLog = createFakeAuditLogRepository()
  const useCase = new SetSchedulerPausedUseCase(
    schedulerAdmin,
    new RecordAdminActionUseCase(auditLog),
  )
  return { useCase, schedulerAdmin, auditLog }
}

describe('SetSchedulerPausedUseCase', () => {
  it('pausa no motor, devolve o estado novo e audita scheduler.pause', async () => {
    const { useCase, schedulerAdmin, auditLog } = build()

    const status = await useCase.execute('admin-1', true)

    expect(status.paused).toBe(true)
    expect(schedulerAdmin.calls).toEqual(['pause'])
    expect(auditLog.entries).toHaveLength(1)
    expect(auditLog.entries[0]).toMatchObject({
      adminId: 'admin-1',
      action: 'scheduler.pause',
      targetType: 'scheduler',
      result: 'success',
    })
  })

  it('retoma no motor e audita scheduler.resume', async () => {
    const { useCase, schedulerAdmin, auditLog } = build()

    const status = await useCase.execute('admin-1', false)

    expect(status.paused).toBe(false)
    expect(schedulerAdmin.calls).toEqual(['resume'])
    expect(auditLog.entries[0]).toMatchObject({ action: 'scheduler.resume', result: 'success' })
  })

  it('motor recusa (agenda desligada): propaga o erro e audita como falha', async () => {
    const { useCase, schedulerAdmin, auditLog } = build()
    schedulerAdmin.errorToThrow = new SchedulerDisabledError('a agenda automática está desligada')

    await expect(useCase.execute('admin-1', true)).rejects.toThrow(SchedulerDisabledError)

    expect(auditLog.entries[0]).toMatchObject({
      action: 'scheduler.pause',
      result: 'failed',
      errorMessage: 'a agenda automática está desligada',
    })
  })
})
