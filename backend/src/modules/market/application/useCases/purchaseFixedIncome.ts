import { FIXED_INCOME_ASSET_TYPES } from '../../domain/assetTypes'
import { assertProductUnlocked } from '../productUnlockGate'
import type { CatalogReader } from '../ports/catalogReader'
import type {
  FixedIncomeExecutor,
  PurchaseFixedIncomeInput,
  PurchaseFixedIncomeResult,
} from '../ports/fixedIncomeExecutor'
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
  ) {}

  async execute(input: PurchaseFixedIncomeInput): Promise<PurchaseFixedIncomeResult> {
    await assertProductUnlocked(
      this.catalogReader,
      this.productUnlockReader,
      input.asset_id,
      input.user_id,
      FIXED_INCOME_ASSET_TYPES,
    )

    return this.fixedIncomeExecutor.purchase(input)
  }
}
