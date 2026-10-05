import type {
  LessonCatalogAdmin,
  LessonCatalogItem,
  LessonPublicationResult,
} from '../ports/lessonCatalogAdmin'
import type { RecordAdminActionUseCase } from './recordAdminAction'

export class ListLessonCatalogAdminUseCase {
  constructor(private readonly lessonCatalog: LessonCatalogAdmin) {}

  execute(): Promise<LessonCatalogItem[]> {
    return this.lessonCatalog.list()
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
