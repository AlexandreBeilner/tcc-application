export class LessonNotFoundError extends Error {}
export class LessonLockedError extends Error {}
export class LessonNotCompletedError extends Error {}
// Aposta com acerto/erro real (backlog engajamento B.2) — `selectedOption`
// fora do intervalo de `lesson.microDecisionOptions.length`. Nunca lançado
// pra lição sem opções reais (checkbox de hoje) — nesse caso o campo é só
// ignorado, ver `AdvanceLessonUseCase`.
export class InvalidMicroDecisionOptionError extends Error {}
