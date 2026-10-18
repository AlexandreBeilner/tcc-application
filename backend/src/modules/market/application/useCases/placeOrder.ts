import { EQUITY_ASSET_TYPES } from '../../domain/assetTypes'
import { assertProductUnlocked } from '../productUnlockGate'
import type { CatalogReader } from '../ports/catalogReader'
import type { LiveTradeListener } from '../ports/liveTradeListener'
import type { OrderExecutor, OrderResult, PlaceOrderInput } from '../ports/orderExecutor'
import type { ProductUnlockReader } from '../ports/productUnlockReader'

// Gate real de desbloqueio por lição (tarefa 7.0.1, achado 5) — só no lado
// `buy`: vender uma posição de um tipo ainda travado não é "comprar
// produto travado" (o usuário só pode ter essa posição porque a comprou
// antes de o tipo ser travado, ou via sandbox) e precisa continuar
// possível, mesmo padrão de `PurchaseFixedIncomeUseCase` não travar
// `RedeemFixedIncomeUseCase`. Lógica do gate em si vive em
// `application/productUnlockGate.ts`, compartilhada com as duas use cases.
export class PlaceOrderUseCase {
  constructor(
    private readonly orderExecutor: OrderExecutor,
    private readonly catalogReader: CatalogReader,
    private readonly productUnlockReader: ProductUnlockReader,
    private readonly liveTradeListener?: LiveTradeListener,
  ) {}

  async execute(input: PlaceOrderInput): Promise<OrderResult> {
    if (input.side === 'buy') {
      await assertProductUnlocked(
        this.catalogReader,
        this.productUnlockReader,
        input.asset_id,
        input.user_id,
        EQUITY_ASSET_TYPES,
      )
    }

    const result = await this.orderExecutor.submit(input)
    // Ordem que só ficou no livro, sem execução, não é "operar" (RT.1.1); a que enche depois, num
    // tick do motor, não passa por aqui e o marco só sai na próxima operação.
    if (result.filled_quantity > 0) {
      await this.notifyLiveTrade(input.user_id, input.asset_id)
    }
    return result
  }

  private async notifyLiveTrade(userId: string, assetId: string): Promise<void> {
    if (!this.liveTradeListener) return
    try {
      const asset = await this.catalogReader.getAsset(assetId)
      if (!asset.is_sandbox) await this.liveTradeListener.onLiveTrade(userId, 'order')
    } catch (err) {
      console.error('[market] falha ao avisar a operação ao vivo', err)
    }
  }
}
