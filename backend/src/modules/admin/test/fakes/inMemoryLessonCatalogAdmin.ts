import {
  ListLessonCatalogUseCase,
  SetLessonPublishedUseCase,
} from '../../../lessons/application/useCases/manageLessonCatalog'
import type { CatalogLesson, LessonFunnelCounts } from '../../../lessons/domain/lessonCatalog'
import { createFakeLessonCatalogRepository } from '../../../lessons/test/fakes/fakeLessonCatalogRepository'
import { createInProcessLessonCatalogAdmin } from '../../infrastructure/lessons/inProcessLessonCatalogAdmin'

// Conteúdo das lições montado sobre repositório em memória e os casos de uso reais do módulo
// `lessons`: os testes de rota exercitam as regras de verdade sem subir banco.
export function createInMemoryLessonCatalogAdmin(seed: {
  lessons?: CatalogLesson[]
  funnels?: Record<string, LessonFunnelCounts>
}) {
  const catalogRepository = createFakeLessonCatalogRepository(seed.lessons ?? [], seed.funnels)
  const lessonCatalogAdmin = createInProcessLessonCatalogAdmin({
    listLessonCatalog: new ListLessonCatalogUseCase(catalogRepository),
    setLessonPublished: new SetLessonPublishedUseCase(catalogRepository),
  })
  return { lessonCatalogAdmin, catalogRepository }
}
