import { ProductLockedError } from '../domain/errors'
import type { CatalogReader } from './ports/catalogReader'
import type { ProductUnlockReader } from './ports/productUnlockReader'

// Gate real de desbloqueio por lição (tarefa 7.0.1) — compartilhado por
// `PlaceOrderUseCase` (só no lado `buy`) e `PurchaseFixedIncomeUseCase`,
// os dois pontos de compra real de produto (extraído da revisão da Semana
// 7: a mesma sequência resolve-asset/skip-sandbox/checa-chave estava
// duplicada nos dois use cases). RF12 isenta sandbox de propósito (é
// justamente prática pré-desbloqueio, travá-la destruiria o propósito).
//
// `relevantTypes` restringe o gate aos tipos de ativo que o endpoint
// chamador de fato negocia (`assetTypes.ts`): um `asset_id` de classe
// errada pro endpoint (ex: ativo de renda fixa batendo em
// `POST /market/orders`) deve estourar o erro de classe do motor (400),
// não o gate de desbloqueio (403) — o gate roda antes do motor e não deve
// mascarar essa validação.
export async function assertProductUnlocked(
  catalogReader: CatalogReader,
  productUnlockReader: ProductUnlockReader,
  assetId: string,
  userId: string,
  relevantTypes: readonly string[],
): Promise<void> {
  const asset = await catalogReader.getAsset(assetId)
  if (asset.is_sandbox || !relevantTypes.includes(asset.type)) {
    return
  }

  const requiredKey = `asset:${asset.type}`
  const unlockedKeys = await productUnlockReader.getUnlockedKeys(userId)
  if (unlockedKeys.has(requiredKey)) {
    return
  }

  const unlockingLesson = await productUnlockReader.findLessonUnlocking(requiredKey)
  throw new ProductLockedError(requiredKey, unlockingLesson)
}
