import type { League, LeagueMember, LeagueMemberStatus, LeagueWindow } from '../../domain/league'

export interface NewLeague {
  ownerId: string
  name: string
  window: LeagueWindow
  now: Date
}

export interface NewMember {
  leagueId: string
  userId: string
  status: LeagueMemberStatus
  invitedBy: string
  now: Date
}

export interface UserLeagueRow {
  league: League
  membership: LeagueMember
}

export interface LeagueRepository {
  // Cria a liga e já grava o dono como membro ativo, tudo numa transação que trava o dono pra
  // duas criações simultâneas não furarem o teto. `null` quando o dono já tem `maxOpen` abertas.
  createIfUnderLimit(input: NewLeague, maxOpen: number): Promise<League | null>
  findById(id: string): Promise<League | null>
  rename(id: string, name: string): Promise<void>
  close(id: string, at: Date): Promise<void>
  // Ligas abertas das quais a pessoa participa (ativa ou convidada).
  listForUser(userId: string): Promise<UserLeagueRow[]>
  listMembers(leagueId: string): Promise<LeagueMember[]>
  findMember(leagueId: string, userId: string): Promise<LeagueMember | null>
  // Insere respeitando o teto de pessoas (membros ativos mais convites). `false` se lotada.
  addMemberIfRoom(input: NewMember, maxMembers: number): Promise<boolean>
  activateMember(leagueId: string, userId: string, at: Date): Promise<void>
  removeMember(leagueId: string, userId: string): Promise<void>
}
