import { LessonNotFoundError, LessonPublicationConflictError } from '../../domain/errors'
import {
  buildLessonFunnel,
  prerequisiteCodes,
  type LessonCatalogEntry,
} from '../../domain/lessonCatalog'
import type { LessonCatalogRepository, PublishChangeResult } from '../ports/lessonCatalogRepository'

// Catálogo completo (publicadas ou não) com funil e pré-requisito, pra tela Conteúdo (N.18).
export class ListLessonCatalogUseCase {
  constructor(private readonly catalog: LessonCatalogRepository) {}

  async execute(): Promise<LessonCatalogEntry[]> {
    const rows = await this.catalog.listWithFunnel()
    const prerequisites = prerequisiteCodes(rows.map((row) => row.lesson))
    return rows.map((row) => ({
      lesson: row.lesson,
      prerequisiteCode: prerequisites.get(row.lesson.id) ?? null,
      funnel: buildLessonFunnel(row.funnel),
    }))
  }
}

// Publica ou despublica uma lição (N.18). Despublicar tira a lição da conta de progressão de todos
// sem apagar progresso (`buildProgression` só recebe as publicadas); publicar de volta dispensa
// quem já passou daquele ponto, pela mesma regra da criação (N.24).
export class SetLessonPublishedUseCase {
  constructor(private readonly catalog: LessonCatalogRepository) {}

  async execute(lessonId: string, published: boolean): Promise<PublishChangeResult> {
    const current = await this.catalog.findById(lessonId)
    if (!current) {
      throw new LessonNotFoundError('lição não encontrada')
    }
    if (current.published === published) {
      throw new LessonPublicationConflictError(
        published ? 'a lição já está publicada' : 'a lição já está despublicada',
      )
    }
    const result = await this.catalog.setPublished(lessonId, published)
    if (!result) {
      throw new LessonNotFoundError('lição não encontrada')
    }
    return result
  }
}
