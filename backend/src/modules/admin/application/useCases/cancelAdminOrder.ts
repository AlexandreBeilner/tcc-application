import type { OrderAdmin } from '../ports/orderAdmin'
import type { RecordAdminActionUseCase } from './recordAdminAction'

// Cancelamento de UMA ordem por intervenção (N.10). A regra (só pending/
// partially_filled, motivo `admin`) vive no motor; aqui só a auditoria, inclusive
// quando o motor recusa (404 inexistente, 409 já executada).
export class CancelAdminOrderUseCase {
  constructor(
    private readonly orderAdmin: OrderAdmin,
    private readonly recordAdminAction: RecordAdminActionUseCase,
  ) {}

  async execute(adminId: string, orderId: string): Promise<void> {
    return this.recordAdminAction.run(
      { adminId, action: 'order.cancel', targetType: 'order', targetId: orderId },
      () => this.orderAdmin.cancel(orderId),
    )
  }
}
