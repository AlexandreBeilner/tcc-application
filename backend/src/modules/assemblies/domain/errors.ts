export class AssemblyNotFoundError extends Error {}
// Nenhum `kind` registrado com esse nome (sem política, não há como votar nem apurar).
export class UnknownAssemblyKindError extends Error {}
// Voto fora da janela (antes de abrir ou depois de fechar).
export class AssemblyNotOpenError extends Error {}
// A opção não pertence à pauta da assembleia.
export class InvalidAssemblyOptionError extends Error {}
// Datas fora de ordem ou pauta malformada na criação.
export class InvalidAssemblyError extends Error {}
