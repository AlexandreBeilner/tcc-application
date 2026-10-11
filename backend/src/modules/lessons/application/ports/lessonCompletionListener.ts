// Avisa outro módulo de que a pessoa acabou de concluir uma lição pela primeira vez (hoje, a
// indicação entre amigos, MO.7.2). Best-effort: falha é só logada e nunca desfaz a conclusão.
export interface LessonCompletionListener {
  onLessonCompleted(userId: string): Promise<void>
}
