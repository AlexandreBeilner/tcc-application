export class AssemblyNotFoundError extends Error {}
// O motor de simulação não respondeu (rede ou 5xx). O que depende dele (placar, voto, propor) devolve
// 503 em vez de 500, e o ciclo em segundo plano tenta de novo na rodada seguinte.
export class GovernanceEngineUnavailableError extends Error {}
// Nenhum `kind` registrado com esse nome (sem política, não há como votar nem apurar).
export class UnknownAssemblyKindError extends Error {}
// Voto fora da janela (antes de abrir ou depois de fechar).
export class AssemblyNotOpenError extends Error {}
// A opção não pertence à pauta da assembleia.
export class InvalidAssemblyOptionError extends Error {}
// Datas fora de ordem ou pauta malformada na criação.
export class InvalidAssemblyError extends Error {}
// Voto recusado por regra (`reason` diz qual; o texto não culpa a pessoa e a 6.6 o traduz em convite).
export class VoteDeniedError extends Error {
  constructor(
    readonly reason: string,
    message: string,
  ) {
    super(message)
  }
}
// Proposta ou apoio recusado por regra (`reason` diz qual; o texto não culpa a pessoa).
export class ProposalDeniedError extends Error {
  constructor(
    readonly reason: string,
    message: string,
  ) {
    super(message)
  }
}
export class ProposalNotFoundError extends Error {}
// Empresa que o motor não conhece.
export class CompanyNotFoundError extends Error {}
// Parâmetro de assembleia desconhecido ou valor fora da faixa permitida (painel, MO.6.8).
export class InvalidAssemblySettingError extends Error {}
// Pausa recusada por regra: já existe uma vigente no escopo, ou escopo/motivo inválidos.
export class AssemblyPauseConflictError extends Error {}
export class InvalidAssemblyPauseError extends Error {}
export class AssemblyPauseNotFoundError extends Error {}
// Pauta do catálogo malformada (painel, MO.6.8) ou inexistente.
export class InvalidAgendaTemplateError extends Error {}
export class AgendaTemplateNotFoundError extends Error {}
export class AgendaTemplateConflictError extends Error {}
