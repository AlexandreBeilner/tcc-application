export class AssemblyNotFoundError extends Error {}
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
