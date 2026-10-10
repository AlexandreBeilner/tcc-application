export class DuelNotFoundError extends Error {}
// Desafiar a si mesmo.
export class SelfDuelError extends Error {}
// Duelo só entre amigos com amizade aceita.
export class NotFriendsError extends Error {}
// Já são 3 duelos em andamento (ativos mais desafios que a pessoa fez e aguardam resposta).
export class TooManyDuelsError extends Error {}
// Já existe um duelo aberto (aguardando ou em andamento) entre as duas pessoas.
export class DuelAlreadyOpenError extends Error {}
// Ação que só vale para duelo aguardando resposta.
export class DuelNotPendingError extends Error {}
// Só quem foi desafiado responde; só quem desafiou cancela.
export class NotDuelOpponentError extends Error {}
export class NotDuelChallengerError extends Error {}
