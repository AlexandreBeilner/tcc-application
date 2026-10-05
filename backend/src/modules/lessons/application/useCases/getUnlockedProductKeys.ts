import { buildProgression, unlockedKeysFor } from '../../domain/lesson'
import type { LessonRepository } from '../ports/lessonRepository'

export interface GetUnlockedProductKeysInput {
  userId: string
}

// Consumida em processo pelo módulo `market` (tarefa 7.0.1) — o gate real
// de `POST /market/orders`/`fixed-income/purchases` (achado 5 da revisão
// da Semana 7) e, do lado do frontend, espelhada em TS puro
// (`frontend/src/features/lessons/unlockedKeys.ts`) a partir dos mesmos
// dados de `GET /lessons`. Usa `buildProgression` (concluídas + dispensadas,
// N.24), a mesma contagem do desbloqueio das lições: dispensa mantém o
// produto liberado, mas não entra em `lessons_completed` (achievements).
export class GetUnlockedProductKeysUseCase {
  constructor(private readonly lessonRepository: LessonRepository) {}

  async execute(input: GetUnlockedProductKeysInput): Promise<Set<string>> {
    const [lessons, progress] = await Promise.all([
      this.lessonRepository.listAll(),
      this.lessonRepository.listProgressForUser(input.userId),
    ])

    return unlockedKeysFor(buildProgression(lessons, progress).satisfiedCount, lessons)
  }
}
