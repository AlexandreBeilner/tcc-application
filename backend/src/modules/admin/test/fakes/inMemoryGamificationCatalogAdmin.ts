import {
  CreateAchievementUseCase,
  ListAchievementCatalogUseCase,
  UpdateAchievementUseCase,
} from '../../../achievements/application/useCases/manageAchievementCatalog'
import type { Achievement } from '../../../achievements/domain/achievement'
import { createFakeAchievementRepository } from '../../../achievements/test/fakes/fakeAchievementRepository'
import {
  ListMissionCatalogUseCase,
  UpdateMissionUseCase,
} from '../../../missions/application/useCases/manageMissionCatalog'
import type { Mission } from '../../../missions/domain/mission'
import { createFakeMissionRepository } from '../../../missions/test/fakes/fakeMissionRepository'
import type {
  AdminRanking,
  AdminRankingQuery,
  AdminRankingReader,
} from '../../application/ports/adminRankingReader'
import { createInProcessGamificationCatalogAdmin } from '../../infrastructure/gamification/inProcessGamificationCatalogAdmin'

// Catálogo operável montado sobre repositórios em memória e os casos de uso reais dos módulos
// donos do dado (conquistas, missões): os testes de rota exercitam as regras de verdade (nome
// repetido, meta inválida, XP fora da faixa) sem subir banco, e sem que a camada HTTP precise
// importar infraestrutura.
export function createInMemoryGamificationCatalogAdmin(seed: {
  achievements?: Achievement[]
  missions?: Mission[]
  today?: string
}) {
  const achievementRepository = createFakeAchievementRepository(seed.achievements ?? [])
  const missionRepository = createFakeMissionRepository(seed.missions ?? [])
  const catalogAdmin = createInProcessGamificationCatalogAdmin({
    listAchievementCatalog: new ListAchievementCatalogUseCase(achievementRepository),
    createAchievement: new CreateAchievementUseCase(achievementRepository),
    updateAchievement: new UpdateAchievementUseCase(achievementRepository),
    listMissionCatalog: new ListMissionCatalogUseCase(
      missionRepository,
      () => seed.today ?? '2026-10-03',
    ),
    updateMission: new UpdateMissionUseCase(missionRepository),
  })
  return { catalogAdmin, achievementRepository, missionRepository }
}

export interface FakeAdminRankingReader extends AdminRankingReader {
  queries: AdminRankingQuery[]
  next: AdminRanking
}

export function createFakeAdminRankingReader(next: AdminRanking): FakeAdminRankingReader {
  const fake: FakeAdminRankingReader = {
    queries: [],
    next,
    async read(query) {
      fake.queries.push(query)
      return fake.next
    },
  }
  return fake
}
