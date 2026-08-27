// EngineRequestError traduz 1:1 um erro do motor de simulação (400/404/
// 422/503/500 — validação, saldo/posição insuficiente, indisponibilidade)
// pro cliente do gateway. `market` não tem regra de negócio própria: a
// regra de fato (matching, precificação, Event Sourcing) vive inteira no
// engine/ — este módulo só autentica e repassa (tarefa 6.0.3).
export class EngineRequestError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'EngineRequestError'
    this.status = status
  }
}
