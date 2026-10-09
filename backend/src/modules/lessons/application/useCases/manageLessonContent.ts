import {
  InvalidLessonContentError,
  LessonNotFoundError,
  LessonRevisionNotFoundError,
  LessonUnchangedError,
} from '../../domain/errors'
import type { CatalogLesson } from '../../domain/lessonCatalog'
import {
  assetTypeOfKey,
  changedFields,
  checkLessonContent,
  contentOf,
  isAssetKey,
  type LessonContent,
} from '../../domain/lessonContent'
import type { AssetTypeLookup } from '../ports/assetTypeLookup'
import type {
  CreatedLesson,
  LessonCatalogRepository,
  LessonRevision,
  LessonRevisionSummary,
} from '../ports/lessonCatalogRepository'

// Validação compartilhada de conteúdo (N.23): as regras puras do domínio mais as que consultam o
// catálogo do motor. Usada pela edição, pela criação e pela restauração, pra o mesmo conteúdo ser
// aceito ou recusado igual nos três caminhos. Devolve os avisos; lança com todas as recusas.
export class LessonContentValidator {
  constructor(private readonly assets: AssetTypeLookup) {}

  async validate(content: LessonContent): Promise<string[]> {
    const { errors, warnings } = checkLessonContent(content)
    // Só consulta o motor se o resto está coerente: evita chamada à toa e mensagem duplicada.
    if (errors.length === 0) {
      errors.push(...(await this.checkTickers(content)))
    }
    if (errors.length > 0) {
      throw new InvalidLessonContentError(errors.join('; '))
    }
    return warnings
  }

  private async checkTickers(content: LessonContent): Promise<string[]> {
    const errors: string[] = []
    if (content.microDecisionAssetTicker !== null) {
      const type = await this.assets.typeOfTicker(content.microDecisionAssetTicker)
      if (type === undefined) {
        errors.push(`o ticker ${content.microDecisionAssetTicker} não existe no catálogo`)
      }
    }
    if (content.unlocksAssetTicker !== null) {
      const type = await this.assets.typeOfTicker(content.unlocksAssetTicker)
      if (type === undefined) {
        errors.push(`o ticker ${content.unlocksAssetTicker} não existe no catálogo`)
      } else {
        const unlockedTypes = content.unlocksKeys.filter(isAssetKey).map(assetTypeOfKey)
        if (!unlockedTypes.includes(type)) {
          errors.push(
            `o ticker ${content.unlocksAssetTicker} é do tipo ${type}, que não está entre as chaves de produto da lição`,
          )
        }
      }
    }
    return errors
  }
}

export interface LessonForEdit {
  lesson: CatalogLesson
  revisions: LessonRevisionSummary[]
}

export class GetLessonForEditUseCase {
  constructor(private readonly catalog: LessonCatalogRepository) {}

  async execute(lessonId: string): Promise<LessonForEdit> {
    const lesson = await this.catalog.findById(lessonId)
    if (!lesson) {
      throw new LessonNotFoundError('lição não encontrada')
    }
    return { lesson, revisions: await this.catalog.listRevisions(lessonId) }
  }
}

export interface ContentSaveResult {
  lesson: CatalogLesson
  warnings: string[]
  // Campos que mudaram, pra auditoria (nunca o texto).
  changedFields: (keyof LessonContent)[]
}

// Edita o conteúdo de uma lição existente (N.23). Identidade e posição (`stable_key`, `code`, trilha,
// ordem) não entram: só o conteúdo. Edição que não muda nada é recusada (não gera revisão vazia).
export class UpdateLessonContentUseCase {
  constructor(
    private readonly catalog: LessonCatalogRepository,
    private readonly validator: LessonContentValidator,
  ) {}

  async execute(
    actorId: string,
    lessonId: string,
    content: LessonContent,
  ): Promise<ContentSaveResult> {
    const current = await this.catalog.findById(lessonId)
    if (!current) {
      throw new LessonNotFoundError('lição não encontrada')
    }
    const changed = changedFields(contentOf(current), content)
    if (changed.length === 0) {
      throw new LessonUnchangedError('nenhuma alteração em relação ao conteúdo atual')
    }
    const warnings = await this.validator.validate(content)
    const lesson = await this.catalog.updateContent(lessonId, content, actorId, 'update')
    if (!lesson) {
      throw new LessonNotFoundError('lição não encontrada')
    }
    return { lesson, warnings, changedFields: changed }
  }
}

export interface LessonCreation extends CreatedLesson {
  warnings: string[]
}

// Cria uma lição no meio (ou fim) do currículo (N.23). Quem já passou daquele ponto não é bloqueado
// por ela (dispensa, N.24); quem ainda não chegou é bloqueado normalmente.
export class CreateLessonUseCase {
  constructor(
    private readonly catalog: LessonCatalogRepository,
    private readonly validator: LessonContentValidator,
  ) {}

  async execute(
    actorId: string,
    input: { content: LessonContent; afterLessonId: string | null },
  ): Promise<LessonCreation> {
    const warnings = await this.validator.validate(input.content)
    const created = await this.catalog.create(input, actorId)
    if (!created) {
      throw new LessonNotFoundError('a lição de referência da posição não existe')
    }
    return { ...created, warnings }
  }
}

export class GetLessonRevisionUseCase {
  constructor(private readonly catalog: LessonCatalogRepository) {}

  async execute(lessonId: string, revisionId: string): Promise<LessonRevision> {
    const revision = await this.catalog.findRevision(lessonId, revisionId)
    if (!revision) {
      throw new LessonRevisionNotFoundError('revisão não encontrada')
    }
    return revision
  }
}

// Volta o conteúdo a um retrato anterior (N.23). Gera uma revisão nova ('restore'), nunca reescreve
// o histórico. O conteúdo restaurado passa pela mesma validação (o catálogo pode ter mudado desde então).
export class RestoreLessonRevisionUseCase {
  constructor(
    private readonly catalog: LessonCatalogRepository,
    private readonly validator: LessonContentValidator,
  ) {}

  async execute(actorId: string, lessonId: string, revisionId: string): Promise<ContentSaveResult> {
    const current = await this.catalog.findById(lessonId)
    if (!current) {
      throw new LessonNotFoundError('lição não encontrada')
    }
    const revision = await this.catalog.findRevision(lessonId, revisionId)
    if (!revision) {
      throw new LessonRevisionNotFoundError('revisão não encontrada')
    }
    const changed = changedFields(contentOf(current), revision.content)
    if (changed.length === 0) {
      throw new LessonUnchangedError('o conteúdo atual já é igual a essa revisão')
    }
    const warnings = await this.validator.validate(revision.content)
    const lesson = await this.catalog.updateContent(lessonId, revision.content, actorId, 'restore')
    if (!lesson) {
      throw new LessonNotFoundError('lição não encontrada')
    }
    return { lesson, warnings, changedFields: changed }
  }
}
