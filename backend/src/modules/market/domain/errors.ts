// EngineRequestError traduz 1:1 um erro do motor de simulação (400/404/
// 422/503/500 — validação, saldo/posição insuficiente, indisponibilidade)
// pro cliente do gateway. `market` não tem regra de negócio própria: a
// regra de fato (matching, precificação, Event Sourcing) vive inteira no
// engine/ — este módulo só autentica e repassa (tarefa 6.0.3).
//
// `details` são os campos extras estruturados que o motor devolve ao lado de
// `error` (ex: `code: 'market_closed'`, `opens_on`, `days_until_open` — tarefa
// S.11), repassados 1:1 pro cliente poder agir sem parsear a mensagem.
export class EngineRequestError extends Error {
  readonly status: number
  readonly details: Record<string, unknown>

  constructor(status: number, message: string, details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'EngineRequestError'
    this.status = status
    this.details = details
  }
}

// Gate real de desbloqueio por lição (tarefa 7.0.1, achado 5 do backlog
// Semana 7) — diferente de `EngineRequestError` acima: esta é regra de
// negócio própria de `market` (o motor não sabe nada de trilha/lição),
// decidida antes de qualquer chamada ao motor. `key` é a chave travada
// ('asset:acao', ...); `unlockingLesson` só falta quando nenhuma lição
// seedada ainda a desbloqueia (currículo incompleto até a 7.1).
export class ProductLockedError extends Error {
  readonly status = 403
  readonly key: string
  readonly unlockingLesson?: { code: string; title: string }

  constructor(key: string, unlockingLesson?: { code: string; title: string }) {
    const hint = unlockingLesson
      ? `Complete a lição ${unlockingLesson.code} (${unlockingLesson.title}) para desbloquear este produto.`
      : 'Complete a lição correspondente na trilha para desbloquear este produto.'
    super(`Produto ainda bloqueado pela trilha. ${hint}`)
    this.name = 'ProductLockedError'
    this.key = key
    this.unlockingLesson = unlockingLesson
  }
}
