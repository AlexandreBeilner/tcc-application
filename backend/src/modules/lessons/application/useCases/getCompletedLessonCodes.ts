import type { LessonRepository } from '../ports/lessonRepository'

export interface GetCompletedLessonCodesInput {
  userId: string
}

// Códigos das lições que a pessoa concluiu, na ordem do currículo (LJ.5.9, coleção de termos do Perfil).
// Consumida em processo pelo módulo `profile`, pelo mesmo motivo de `GetCompletedTracksUseCase`: o perfil é de
// *outro* usuário e `GET /lessons` só lê o próprio. Lição só dispensada (N.24) não conta: dispensa libera o
// caminho, não ensina o termo. Nenhum dado financeiro: é só o progresso de estudo.
export class GetCompletedLessonCodesUseCase {
  constructor(private readonly lessonRepository: LessonRepository) {}

  async execute(input: GetCompletedLessonCodesInput): Promise<string[]> {
    const [lessons, progress] = await Promise.all([
      this.lessonRepository.listAll(),
      this.lessonRepository.listProgressForUser(input.userId),
    ])
    const completed = new Set(progress.filter((p) => p.completedAt !== null).map((p) => p.lessonId))
    return lessons.filter((lesson) => completed.has(lesson.id)).map((lesson) => lesson.code)
  }
}
