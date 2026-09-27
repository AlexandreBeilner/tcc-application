export class LessonNotFoundError extends Error {}
export class LessonLockedError extends Error {}
export class LessonNotCompletedError extends Error {}
// Aposta com acerto/erro real (backlog engajamento B.2) — `selectedOption`
// fora do intervalo de `lesson.microDecisionOptions.length`. Nunca lançado
// pra lição sem opções reais (checkbox de hoje) — nesse caso o campo é só
// ignorado, ver `AdvanceLessonUseCase`.
export class InvalidMicroDecisionOptionError extends Error {}
// Gate de passos da lição (backlog Fase S, S.4/achado 020) — `step` só pode
// ser o `currentStep` gravado (reenvio) ou `currentStep + 1`; qualquer salto
// (ex: 0 direto pro 3) é recusado.
export class LessonStepOutOfOrderError extends Error {}
// Avanço de passo antes do tempo mínimo desde o último passo gravado;
// `retryAfterMs` diz quanto falta, pro cliente poder esperar em vez de só
// falhar.
export class LessonStepTooFastError extends Error {
  constructor(
    message: string,
    readonly retryAfterMs: number,
  ) {
    super(message)
  }
}
