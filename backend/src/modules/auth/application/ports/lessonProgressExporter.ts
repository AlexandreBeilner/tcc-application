// Port própria e mínima sobre `modules/lessons` (5.6) — implementada, na
// composição (app.ts), por um adapter em processo sobre
// `ExportLessonProgressUseCase`.
export interface ExportedLessonProgress {
  lessonId: string
  currentStep: number
  completedAt: Date | null
}

export interface LessonProgressExporter {
  exportForUser(userId: string): Promise<ExportedLessonProgress[]>
}
