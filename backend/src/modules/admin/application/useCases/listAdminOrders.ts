import type { ListAdminOrdersQuery, ListAdminOrdersResult, OrderAdmin } from '../ports/orderAdmin'

// Delegação fina (leitura), mesmo padrão de ListMarketMonitorUseCase.
export class ListAdminOrdersUseCase {
  constructor(private readonly orderAdmin: OrderAdmin) {}

  async execute(query: ListAdminOrdersQuery): Promise<ListAdminOrdersResult> {
    return this.orderAdmin.list(query)
  }
}
