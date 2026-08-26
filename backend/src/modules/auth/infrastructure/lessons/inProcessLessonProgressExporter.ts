import type { ExportLessonProgressUseCase } from '../../../lessons/application/useCases/exportLessonProgress'
import type { LessonProgressExporter } from '../../application/ports/lessonProgressExporter'

export function createInProcessLessonProgressExporter(
  exportLessonProgress: ExportLessonProgressUseCase,
): LessonProgressExporter {
  return {
    async exportForUser(userId) {
      return exportLessonProgress.execute({ userId })
    },
  }
}
