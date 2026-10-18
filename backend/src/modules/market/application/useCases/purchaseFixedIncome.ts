import { FIXED_INCOME_ASSET_TYPES } from '../../domain/assetTypes'
import { assertProductUnlocked } from '../productUnlockGate'
import type { CatalogReader } from '../ports/catalogReader'
import type {
  FixedIncomeExecutor,
  PurchaseFixedIncomeInput,
  PurchaseFixedIncomeResult,
} from '../ports/fixedIncomeExecutor'
import type { LiveTradeListener } from '../ports/liveTradeListener'
import type { ProductUnlockReader } from '../ports/productUnlockReader'

// Mesmo gate de `PlaceOrderUseCase` (tarefa 7.0.1, `application/
// productUnlockGate.ts`) — só na compra (`purchase`), não no resgate
// (`RedeemFixedIncomeUseCase`): resgatar uma posição que o usuário já tem
// não é "comprar produto travado".
export class PurchaseFixedIncomeUseCase {
  constructor(
    private readonly fixedIncomeExecutor: FixedIncomeExecutor,
    private readonly catalogReader: CatalogReader,
    private readonly productUnlockReader: ProductUnlockReader,
    private readonly liveTradeListener?: LiveTradeListener,
  ) {}

  async execute(input: PurchaseFixedIncomeInput): Promise<PurchaseFixedIncomeResult> {
    await assertProductUnlocked(
      this.catalogReader,
      this.productUnlockReader,
      input.asset_id,
      input.user_id,
      FIXED_INCOME_ASSET_TYPES,
    )

    const result = await this.fixedIncomeExecutor.purchase(input)
    await this.notifyLiveTrade(input.user_id, input.asset_id)
    return result
  }

  private async notifyLiveTrade(userId: string, assetId: string): Promise<void> {
    if (!this.liveTradeListener) return
    try {
      const asset = await this.catalogReader.getAsset(assetId)
      if (!asset.is_sandbox) await this.liveTradeListener.onLiveTrade(userId, 'fixed_income')
    } catch (err) {
      console.error('[market] falha ao avisar a compra de renda fixa ao vivo', err)
    }
  }
}
