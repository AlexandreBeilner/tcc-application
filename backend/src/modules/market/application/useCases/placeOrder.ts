import { ProductLockedError } from '../../domain/errors'
import type { CatalogReader } from '../ports/catalogReader'
import type { OrderExecutor, OrderResult, PlaceOrderInput } from '../ports/orderExecutor'
import type { ProductUnlockReader } from '../ports/productUnlockReader'

// Gate real de desbloqueio por lição (tarefa 7.0.1, achado 5): resolve o
// `AssetType` do ativo-alvo e, se não for sandbox, exige `asset:<type>` no
// conjunto desbloqueado do usuário — RF12 isenta sandbox de propósito
// (é justamente prática pré-desbloqueio, travá-la destruiria o propósito).
export class PlaceOrderUseCase {
  constructor(
    private readonly orderExecutor: OrderExecutor,
    private readonly catalogReader: CatalogReader,
    private readonly productUnlockReader: ProductUnlockReader,
  ) {}

  async execute(input: PlaceOrderInput): Promise<OrderResult> {
    const asset = await this.catalogReader.getAsset(input.asset_id)
    if (!asset.is_sandbox) {
      const requiredKey = `asset:${asset.type}`
      const unlockedKeys = await this.productUnlockReader.getUnlockedKeys(input.user_id)
      if (!unlockedKeys.has(requiredKey)) {
        const unlockingLesson = await this.productUnlockReader.findLessonUnlocking(requiredKey)
        throw new ProductLockedError(requiredKey, unlockingLesson)
      }
    }

    return this.orderExecutor.submit(input)
  }
}
