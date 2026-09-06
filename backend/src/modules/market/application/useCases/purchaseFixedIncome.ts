import { ProductLockedError } from '../../domain/errors'
import type { CatalogReader } from '../ports/catalogReader'
import type {
  FixedIncomeExecutor,
  PurchaseFixedIncomeInput,
  PurchaseFixedIncomeResult,
} from '../ports/fixedIncomeExecutor'
import type { ProductUnlockReader } from '../ports/productUnlockReader'

// Mesmo gate de `PlaceOrderUseCase` (tarefa 7.0.1) — só na compra
// (`purchase`), não no resgate (`RedeemFixedIncomeUseCase`): resgatar uma
// posição que o usuário já tem não é "comprar produto travado".
export class PurchaseFixedIncomeUseCase {
  constructor(
    private readonly fixedIncomeExecutor: FixedIncomeExecutor,
    private readonly catalogReader: CatalogReader,
    private readonly productUnlockReader: ProductUnlockReader,
  ) {}

  async execute(input: PurchaseFixedIncomeInput): Promise<PurchaseFixedIncomeResult> {
    const asset = await this.catalogReader.getAsset(input.asset_id)
    if (!asset.is_sandbox) {
      const requiredKey = `asset:${asset.type}`
      const unlockedKeys = await this.productUnlockReader.getUnlockedKeys(input.user_id)
      if (!unlockedKeys.has(requiredKey)) {
        const unlockingLesson = await this.productUnlockReader.findLessonUnlocking(requiredKey)
        throw new ProductLockedError(requiredKey, unlockingLesson)
      }
    }

    return this.fixedIncomeExecutor.purchase(input)
  }
}
