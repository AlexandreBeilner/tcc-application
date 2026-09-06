import { countCompleted, unlockedKeysFor } from '../../domain/lesson'
import type { LessonRepository } from '../ports/lessonRepository'

export interface GetUnlockedProductKeysInput {
  userId: string
}

// Consumida em processo pelo módulo `market` (tarefa 7.0.1) — o gate real
// de `POST /market/orders`/`fixed-income/purchases` (achado 5 da revisão
// da Semana 7) e, do lado do frontend, espelhada em TS puro
// (`frontend/src/features/lessons/unlockedKeys.ts`) a partir dos mesmos
// dados de `GET /lessons`. `countCompleted` (mesmo critério de
// `CountCompletedLessonsUseCase`) garante que este gate nunca divirja da
// contagem usada por `achievements` pro critério `lessons_completed`.
export class GetUnlockedProductKeysUseCase {
  constructor(private readonly lessonRepository: LessonRepository) {}

  async execute(input: GetUnlockedProductKeysInput): Promise<Set<string>> {
    const [lessons, progress] = await Promise.all([
      this.lessonRepository.listAll(),
      this.lessonRepository.listProgressForUser(input.userId),
    ])

    return unlockedKeysFor(countCompleted(progress), lessons)
  }
}
