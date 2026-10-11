import type { Database } from '../../db/client'
import type { AuthMiddleware } from '../../shared/http/authMiddleware'
import type { ProAccess } from './application/ports/proAccess'
import type { ReferralUnlocks } from './application/ports/referralUnlocks'
import { EquipCosmeticUseCase } from './application/useCases/equipCosmetic'
import { GetCosmeticDisplaysUseCase } from './application/useCases/getCosmeticDisplays'
import { ListMyCosmeticsUseCase } from './application/useCases/listMyCosmetics'
import { UnequipCosmeticUseCase } from './application/useCases/unequipCosmetic'
import { createInProcessProMembershipReader } from './infrastructure/billing/inProcessProMembershipReader'
import { createDrizzleCosmeticCatalogRepository } from './infrastructure/persistence/drizzleCosmeticCatalogRepository'
import { createDrizzleCosmeticSelectionRepository } from './infrastructure/persistence/drizzleCosmeticSelectionRepository'
import { createCosmeticsRouter } from './interfaces/http/cosmeticsRouter'

export interface CosmeticsCompositionDeps {
  db: Database
  authMiddleware: AuthMiddleware
  // Do módulo `billing`: gate de PRO e leitura em lote de quem é PRO.
  proAccess: ProAccess
  listActiveProUserIds: { execute(userIds: string[]): Promise<Set<string>> }
  // Do módulo `referrals`: libera títulos por indicações válidas (MO.7.2).
  referralUnlocks?: ReferralUnlocks
}

// Composição do módulo `cosmetics` (único lugar que instancia os adapters concretos). Devolve o
// router e `getCosmeticDisplays`, que ranking, feed social, amizades e perfil consomem pelas
// portas próprias deles.
export function createCosmeticsModule(deps: CosmeticsCompositionDeps) {
  const catalog = createDrizzleCosmeticCatalogRepository(deps.db)
  const selections = createDrizzleCosmeticSelectionRepository(deps.db)
  const membership = createInProcessProMembershipReader(deps.listActiveProUserIds)

  const getCosmeticDisplays = new GetCosmeticDisplaysUseCase(catalog, selections, membership)
  const listMyCosmetics = new ListMyCosmeticsUseCase(catalog, selections, membership, deps.referralUnlocks)
  const router = createCosmeticsRouter({
    listMyCosmetics,
    equipCosmetic: new EquipCosmeticUseCase(deps.proAccess, catalog, selections, deps.referralUnlocks),
    unequipCosmetic: new UnequipCosmeticUseCase(selections),
    authMiddleware: deps.authMiddleware,
  })
  return { router, getCosmeticDisplays }
}
