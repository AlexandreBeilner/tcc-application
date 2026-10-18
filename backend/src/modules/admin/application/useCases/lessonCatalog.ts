import type {
  LessonCatalogAdmin,
  LessonContentView,
  LessonCreateOutcome,
  LessonForEditView,
  LessonCardFunnelView,
  LessonCatalogItem,
  LessonPublicationResult,
  LessonRevisionDetail,
  LessonSaveOutcome,
} from '../ports/lessonCatalogAdmin'
import type { RecordAdminActionUseCase } from './recordAdminAction'

export class ListLessonCatalogAdminUseCase {
  constructor(private readonly lessonCatalog: LessonCatalogAdmin) {}

  execute(): Promise<LessonCatalogItem[]> {
    return this.lessonCatalog.list()
  }
}

// Funil por cartão de uma lição (LJ.5.1). Leitura, sem auditoria (não mexe em nada).
export class GetLessonCardFunnelAdminUseCase {
  constructor(private readonly lessonCatalog: LessonCatalogAdmin) {}

  execute(lessonId: string, days?: number): Promise<LessonCardFunnelView> {
    return this.lessonCatalog.cardFunnel(lessonId, days)
  }
}

// Publica ou despublica uma lição (N.18). Auditada com o código da lição e, ao publicar, quantos
// usuários receberam dispensa (a regra da N.24 evita que a lição volte bloqueando quem já passou).
export class SetLessonPublishedAdminUseCase {
  constructor(
    private readonly lessonCatalog: LessonCatalogAdmin,
    private readonly recordAdminAction: RecordAdminActionUseCase,
  ) {}

  execute(adminId: string, lessonId: string, published: boolean): Promise<LessonPublicationResult> {
    return this.recordAdminAction.run(
      {
        adminId,
        action: published ? 'lesson.publish' : 'lesson.unpublish',
        targetType: 'lesson',
        targetId: lessonId,
      },
      () => this.lessonCatalog.setPublished(lessonId, published),
      (result) => ({ payload: { code: result.code, waived_users: result.waivedUsers } }),
    )
  }
}

export class GetLessonForEditAdminUseCase {
  constructor(private readonly lessonCatalog: LessonCatalogAdmin) {}

  execute(lessonId: string): Promise<LessonForEditView> {
    return this.lessonCatalog.get(lessonId)
  }
}

export class GetLessonRevisionAdminUseCase {
  constructor(private readonly lessonCatalog: LessonCatalogAdmin) {}

  execute(lessonId: string, revisionId: string): Promise<LessonRevisionDetail> {
    return this.lessonCatalog.getRevision(lessonId, revisionId)
  }
}

// camelCase do domínio -> snake_case do log, só os nomes dos campos (nunca o texto da lição).
function snake(field: string): string {
  return field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

// Edita o conteúdo de uma lição (N.23). Auditada com o código e quais campos mudaram; a recusa de
// conteúdo inválido vira falha auditada com a mensagem do domínio.
export class UpdateLessonContentAdminUseCase {
  constructor(
    private readonly lessonCatalog: LessonCatalogAdmin,
    private readonly recordAdminAction: RecordAdminActionUseCase,
  ) {}

  execute(
    adminId: string,
    lessonId: string,
    content: LessonContentView,
  ): Promise<LessonSaveOutcome> {
    return this.recordAdminAction.run(
      { adminId, action: 'lesson.update', targetType: 'lesson', targetId: lessonId },
      () => this.lessonCatalog.update(adminId, lessonId, content),
      (result) => ({
        payload: { code: result.lesson.code, changed_fields: result.changedFields.map(snake) },
      }),
    )
  }
}

// Cria uma lição (N.23). Auditada com o código gerado, a posição pedida e quantos usuários foram
// dispensados dela (quem já tinha passado do ponto).
export class CreateLessonAdminUseCase {
  constructor(
    private readonly lessonCatalog: LessonCatalogAdmin,
    private readonly recordAdminAction: RecordAdminActionUseCase,
  ) {}

  execute(
    adminId: string,
    input: { content: LessonContentView; afterLessonId: string | null },
  ): Promise<LessonCreateOutcome> {
    return this.recordAdminAction.run(
      {
        adminId,
        action: 'lesson.create',
        targetType: 'lesson',
        payload: { after_lesson_id: input.afterLessonId, title: input.content.title },
      },
      () => this.lessonCatalog.create(adminId, input),
      (result) => ({
        targetId: result.lesson.id,
        payload: { code: result.lesson.code, waived_users: result.waivedUsers },
      }),
    )
  }
}

// Restaura uma revisão anterior (N.23): gera uma revisão nova, o histórico só cresce.
export class RestoreLessonRevisionAdminUseCase {
  constructor(
    private readonly lessonCatalog: LessonCatalogAdmin,
    private readonly recordAdminAction: RecordAdminActionUseCase,
  ) {}

  execute(adminId: string, lessonId: string, revisionId: string): Promise<LessonSaveOutcome> {
    return this.recordAdminAction.run(
      {
        adminId,
        action: 'lesson.restore',
        targetType: 'lesson',
        targetId: lessonId,
        payload: { revision_id: revisionId },
      },
      () => this.lessonCatalog.restore(adminId, lessonId, revisionId),
      (result) => ({
        payload: { code: result.lesson.code, changed_fields: result.changedFields.map(snake) },
      }),
    )
  }
}
