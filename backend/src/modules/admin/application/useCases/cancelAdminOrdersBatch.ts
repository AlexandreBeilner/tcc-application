import type { CancelBatchFilter, CancelBatchResult, OrderAdmin } from '../ports/orderAdmin'
import type { RecordAdminActionUseCase } from './recordAdminAction'

// Cancelamento em lote por ativo e/ou dono (N.10). Auditado como UMA ação com o
// filtro e a lista de ids cancelados; lote acima do teto é recusado pelo motor
// (nada cancelado) e fica no log como falha com o motivo.
export class CancelAdminOrdersBatchUseCase {
  constructor(
    private readonly orderAdmin: OrderAdmin,
    private readonly recordAdminAction: RecordAdminActionUseCase,
  ) {}

  async execute(adminId: string, filter: CancelBatchFilter): Promise<CancelBatchResult> {
    return this.recordAdminAction.run(
      {
        adminId,
        action: 'order.cancel_batch',
        targetType: 'order',
        payload: { asset_id: filter.assetId ?? null, user_id: filter.userId ?? null },
      },
      () => this.orderAdmin.cancelBatch(filter),
      (result) => ({
        payload: { cancelled_count: result.cancelled_count, cancelled_ids: result.cancelled_ids },
      }),
    )
  }
}
