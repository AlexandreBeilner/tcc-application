import { randomInt } from 'node:crypto'
import type { Database } from '../../db/client'
import type { AuthMiddleware } from '../../shared/http/authMiddleware'
import type { CheckAndUnlockAchievementsUseCase } from '../achievements/application/useCases/checkAndUnlockAchievements'
import { AttributeReferralUseCase } from './application/useCases/attributeReferral'
import { GetMyReferralUseCase } from './application/useCases/getMyReferral'
import { QualifyReferralUseCase } from './application/useCases/qualifyReferral'
import { createInProcessAchievementUnlocker } from './infrastructure/achievements/inProcessAchievementUnlocker'
import { createDrizzleReferralRepository } from './infrastructure/persistence/drizzleReferralRepository'
import { createReferralsRouter } from './interfaces/http/referralsRouter'

// Peças sem dependência de outros módulos, montadas cedo em `app.ts` (cadastro e vitrine de
// cosméticos nascem antes do módulo completo, que precisa das conquistas).
export function createReferralsCore(db: Database) {
  const referrals = createDrizzleReferralRepository(db)
  return {
    referrals,
    attribute: new AttributeReferralUseCase(referrals),
    countQualified: (userId: string) => referrals.countQualified(userId),
  }
}

export interface ReferralsDeps {
  db: Database
  authMiddleware: AuthMiddleware
  checkAndUnlockAchievements: Pick<CheckAndUnlockAchievementsUseCase, 'execute'>
}

// Composição do módulo `referrals` (MO.7.2): único lugar que instancia os adapters. Devolve o
// router e as duas peças que OUTROS módulos chamam: `attribute` (cadastro) e `qualify` (primeira
// lição concluída), mais `countQualified` pro critério de conquista e pro título liberado.
export function createReferralsModule(deps: ReferralsDeps) {
  const { referrals, attribute, countQualified } = createReferralsCore(deps.db)
  const qualify = new QualifyReferralUseCase(
    referrals,
    createInProcessAchievementUnlocker(deps.checkAndUnlockAchievements),
  )
  const getMyReferral = new GetMyReferralUseCase(referrals, (max) => randomInt(max))
  return {
    router: createReferralsRouter({ getMyReferral, authMiddleware: deps.authMiddleware }),
    attribute,
    qualify,
    countQualified,
  }
}
