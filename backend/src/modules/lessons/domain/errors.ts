export class LessonNotFoundError extends Error {}
export class LessonLockedError extends Error {}
export class LessonNotCompletedError extends Error {}
// `POST /lessons/:id/answer` numa lição sem pergunta com alternativas reais.
export class NoMicroDecisionError extends Error {}
// Avanço do passo Micro-decisão pro Revelação sem ter acertado a pergunta
// (RC.2.3): errar não avança.
export class MicroDecisionUnsolvedError extends Error {}
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
// Pergunta intermediária (`check`, RC.3.2): checkpoint inexistente na lição.
export class CheckpointNotFoundError extends Error {}
// Resposta fora do formato do bloco (índice inválido, valor não numérico).
export class InvalidCheckpointResponseError extends Error {}
// Avanço de fase sem ter resolvido as perguntas intermediárias dela (RC.3.2).
export class CheckpointUnsolvedError extends Error {}
// Correção manual de lição pelo painel (N.17).
export class LessonAlreadyCompletedError extends Error {}
export class LessonNotReopenableError extends Error {}
