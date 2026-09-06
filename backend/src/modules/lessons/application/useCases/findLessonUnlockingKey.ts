import type { LessonRepository } from '../ports/lessonRepository'

export interface FindLessonUnlockingKeyInput {
  key: string
}

export interface LessonUnlockHint {
  code: string
  title: string
}

// Consumida em processo pelo módulo `market` (tarefa 7.0.1) — monta a
// mensagem do 403 ("desbloqueia na lição X") quando `POST /market/orders`/
// `fixed-income/purchases` nega um produto ainda travado.
export class FindLessonUnlockingKeyUseCase {
  constructor(private readonly lessonRepository: LessonRepository) {}

  async execute(input: FindLessonUnlockingKeyInput): Promise<LessonUnlockHint | undefined> {
    const lessons = await this.lessonRepository.listAll()
    const lesson = lessons.find((l) => l.unlocksKeys.includes(input.key))
    return lesson ? { code: lesson.code, title: lesson.title } : undefined
  }
}
