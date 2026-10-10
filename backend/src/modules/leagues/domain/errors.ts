export class InvalidLeagueNameError extends Error {}
// Dono já tem 3 ligas abertas.
export class LeagueLimitReachedError extends Error {}
// Liga já tem 20 pessoas (entre membros e convites pendentes).
export class LeagueFullError extends Error {}
export class LeagueNotFoundError extends Error {}
export class NotLeagueOwnerError extends Error {}
// Convite só entre amigos com amizade aceita.
export class NotFriendsError extends Error {}
export class AlreadyInLeagueError extends Error {}
export class InvitationNotFoundError extends Error {}
export class OwnerCannotLeaveError extends Error {}
// Ação sobre uma liga já encerrada pelo dono.
export class LeagueClosedError extends Error {}
// Liga arquivada (dono sem PRO): só leitura até reativar.
export class LeagueArchivedError extends Error {}
