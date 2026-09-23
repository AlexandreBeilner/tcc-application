import type { OrderExecutor } from '../ports/orderExecutor'

export interface CancelOrderInput {
  order_id: string
  user_id: string
}

// Sem regra de negócio própria (tarefa O.1) — dono/status da ordem são
// validados inteiramente no motor (`OrderExecutionRepository.CancelOrder`),
// que já devolve 404/409 conforme o caso. Diferente de `PlaceOrderUseCase`,
// não passa pelo gate de desbloqueio por lição (7.0.1): cancelar uma ordem
// não é "comprar produto travado".
export class CancelOrderUseCase {
  constructor(private readonly orderExecutor: OrderExecutor) {}

  async execute(input: CancelOrderInput): Promise<void> {
    await this.orderExecutor.cancel(input.order_id, input.user_id)
  }
}
