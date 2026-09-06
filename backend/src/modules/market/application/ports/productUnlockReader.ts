// Port própria e mínima sobre `modules/lessons` (tarefa 7.0.1) — mesmo
// padrão de porta-por-consumidor já usado a semana inteira (ex:
// `modules/missions/application/ports/lessonCompletionChecker.ts`).
// `getUnlockedKeys`/`findLessonUnlocking` espelham 1:1
// `GetUnlockedProductKeysUseCase`/`FindLessonUnlockingKeyUseCase` de
// `lessons` — o adapter em processo só repassa a chamada.
export interface LessonUnlockHint {
  code: string
  title: string
}

export interface ProductUnlockReader {
  getUnlockedKeys(userId: string): Promise<Set<string>>
  findLessonUnlocking(key: string): Promise<LessonUnlockHint | undefined>
}
