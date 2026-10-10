import {
  ListLessonCatalogUseCase,
  SetLessonPublishedUseCase,
} from '../../../lessons/application/useCases/manageLessonCatalog'
import {
  CreateLessonUseCase,
  GetLessonForEditUseCase,
  GetLessonRevisionUseCase,
  LessonContentValidator,
  RestoreLessonRevisionUseCase,
  UpdateLessonContentUseCase,
} from '../../../lessons/application/useCases/manageLessonContent'
import type { AssetTypeLookup } from '../../../lessons/application/ports/assetTypeLookup'
import type { CatalogLesson, LessonFunnelCounts } from '../../../lessons/domain/lessonCatalog'
import { createFakeLessonCatalogRepository } from '../../../lessons/test/fakes/fakeLessonCatalogRepository'
import { createInProcessLessonCatalogAdmin } from '../../infrastructure/lessons/inProcessLessonCatalogAdmin'

// Conteúdo das lições montado sobre repositório em memória e os casos de uso reais do módulo
// `lessons`: os testes de rota exercitam as regras de verdade (aposta, chaves, ticker) sem subir banco.
export function createInMemoryLessonCatalogAdmin(seed: {
  lessons?: CatalogLesson[]
  funnels?: Record<string, LessonFunnelCounts>
  // ticker -> tipo do ativo no catálogo do motor
  assets?: Record<string, string>
}) {
  const catalogRepository = createFakeLessonCatalogRepository(seed.lessons ?? [], seed.funnels)
  const assets: AssetTypeLookup = {
    async typeOfTicker(ticker) {
      return (seed.assets ?? {})[ticker]
    },
  }
  const validator = new LessonContentValidator(assets)
  const lessonCatalogAdmin = createInProcessLessonCatalogAdmin({
    listLessonCatalog: new ListLessonCatalogUseCase(catalogRepository),
    setLessonPublished: new SetLessonPublishedUseCase(catalogRepository),
    getLessonForEdit: new GetLessonForEditUseCase(catalogRepository),
    updateLessonContent: new UpdateLessonContentUseCase(catalogRepository, validator),
    createLesson: new CreateLessonUseCase(catalogRepository, validator),
    getLessonRevision: new GetLessonRevisionUseCase(catalogRepository),
    restoreLessonRevision: new RestoreLessonRevisionUseCase(catalogRepository, validator),
  })
  return { lessonCatalogAdmin, catalogRepository }
}
