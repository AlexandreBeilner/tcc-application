import { completedTrackNumbers } from '../../domain/lesson'
import type { LessonRepository } from '../ports/lessonRepository'

export interface GetCompletedTracksInput {
  userId: string
}

// Consumida em processo pelo módulo `profile` (backlog de engajamento F.2,
// sala de troféus do Perfil) — precisa de trilhas concluídas de *outro*
// usuário, o que `GET /lessons` (`GetTrackMapUseCase`) nunca serve porque só
// lê `req.auth.userId` (confirmado em `lessonsRouter.ts`). Chamar este caso
// de uso direto, fora de qualquer rota HTTP, com o `userId` de entrada
// evita esse acoplamento sem duplicar a regra de "trilha completa".
export class GetCompletedTracksUseCase {
  constructor(private readonly lessonRepository: LessonRepository) {}

  async execute(input: GetCompletedTracksInput): Promise<number[]> {
    const [lessons, progress] = await Promise.all([
      this.lessonRepository.listAll(),
      this.lessonRepository.listProgressForUser(input.userId),
    ])

    const completedAtByLessonId = new Map(progress.map((p) => [p.lessonId, p.completedAt]))

    return completedTrackNumbers(
      lessons.map((lesson) => ({
        trackNumber: lesson.trackNumber,
        completedAt: completedAtByLessonId.get(lesson.id) ?? null,
      })),
    )
  }
}
