import type {
  ExportedLessonProgress,
  LessonProgressExporter,
} from '../../application/ports/lessonProgressExporter'

export function createFakeLessonProgressExporter(
  byUserId: Record<string, ExportedLessonProgress[]> = {},
): LessonProgressExporter {
  return {
    async exportForUser(userId) {
      return byUserId[userId] ?? []
    },
  }
}
