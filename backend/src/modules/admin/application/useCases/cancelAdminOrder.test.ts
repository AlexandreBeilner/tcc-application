import { describe, expect, it } from 'vitest'
import { AdminOrderNotCancellableError, BatchTooLargeError } from '../../domain/errors'
import { createFakeAuditLogRepository } from '../../test/fakes/fakeAuditLogRepository'
import { createFakeOrderAdmin } from '../../test/fakes/fakeOrderAdmin'
import { CancelAdminOrderUseCase } from './cancelAdminOrder'
import { CancelAdminOrdersBatchUseCase } from './cancelAdminOrdersBatch'
import { RecordAdminActionUseCase } from './recordAdminAction'

function build() {
  const orderAdmin = createFakeOrderAdmin()
  const auditLog = createFakeAuditLogRepository()
  const record = new RecordAdminActionUseCase(auditLog)
  return {
    orderAdmin,
    auditLog,
    cancel: new CancelAdminOrderUseCase(orderAdmin, record),
    cancelBatch: new CancelAdminOrdersBatchUseCase(orderAdmin, record),
  }
}

describe('CancelAdminOrderUseCase', () => {
  it('cancela no motor e audita order.cancel com o id da ordem', async () => {
    const { cancel, orderAdmin, auditLog } = build()

    await cancel.execute('admin-1', 'ord-1')

    expect(orderAdmin.calls).toEqual(['cancel:ord-1'])
    expect(auditLog.entries[0]).toMatchObject({
      adminId: 'admin-1',
      action: 'order.cancel',
      targetType: 'order',
      targetId: 'ord-1',
      result: 'success',
    })
  })

  it('ordem já executada: propaga o erro e audita como falha', async () => {
    const { cancel, orderAdmin, auditLog } = build()
    orderAdmin.errorToThrow = new AdminOrderNotCancellableError('ordem já executada')

    await expect(cancel.execute('admin-1', 'ord-1')).rejects.toThrow(AdminOrderNotCancellableError)
    expect(auditLog.entries[0]).toMatchObject({
      action: 'order.cancel',
      result: 'failed',
      errorMessage: 'ordem já executada',
    })
  })
})

describe('CancelAdminOrdersBatchUseCase', () => {
  it('audita UMA ação com o filtro e a lista de ids cancelados', async () => {
    const { cancelBatch, orderAdmin, auditLog } = build()

    const result = await cancelBatch.execute('admin-1', { assetId: 'asset-1' })

    expect(result.cancelled_count).toBe(2)
    expect(orderAdmin.batchFilters).toEqual([{ assetId: 'asset-1' }])
    expect(auditLog.entries).toHaveLength(1)
    expect(auditLog.entries[0]).toMatchObject({
      action: 'order.cancel_batch',
      result: 'success',
      payload: {
        asset_id: 'asset-1',
        user_id: null,
        cancelled_count: 2,
        cancelled_ids: ['a', 'b'],
      },
    })
  })

  it('lote acima do teto: nada cancelado, falha auditada com o motivo', async () => {
    const { cancelBatch, orderAdmin, auditLog } = build()
    orderAdmin.errorToThrow = new BatchTooLargeError('o filtro atinge 501 ordens', 501, 500)

    await expect(cancelBatch.execute('admin-1', { userId: 'user-1' })).rejects.toThrow(
      BatchTooLargeError,
    )
    expect(auditLog.entries[0]).toMatchObject({
      action: 'order.cancel_batch',
      result: 'failed',
      payload: { asset_id: null, user_id: 'user-1' },
    })
  })
})
