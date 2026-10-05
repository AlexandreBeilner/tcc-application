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
// Correção manual de lição pelo painel (N.17).
export class LessonAlreadyCompletedError extends Error {}
export class LessonNotReopenableError extends Error {}
// Gestão do catálogo de lições pelo painel (N.18/N.23).
// Publicar lição já publicada, ou despublicar uma já despublicada.
export class LessonPublicationConflictError extends Error {}
// Conteúdo que a regra de domínio da lição recusa (N.23). A mensagem lista todas as recusas.
export class InvalidLessonContentError extends Error {}
// Edição que não muda nada (N.23): não gera revisão nem linha de auditoria de sucesso.
export class LessonUnchangedError extends Error {}
// Revisão que não existe ou é de outra lição (N.23).
export class LessonRevisionNotFoundError extends Error {}
