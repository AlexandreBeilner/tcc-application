import type { League } from '../domain/league'
import { LeagueNotFoundError, NotLeagueOwnerError } from '../domain/errors'
import type { LeagueRepository } from './ports/leagueRepository'

// Liga aberta que existe e da qual a pessoa participa (ativa ou convidada). Qualquer outro caso
// é "não encontrada": nunca revela a existência de uma liga a quem não é de dentro.
export async function loadLeagueForMember(
  leagues: LeagueRepository,
  leagueId: string,
  userId: string,
) {
  const [league, membership] = await Promise.all([
    leagues.findById(leagueId),
    leagues.findMember(leagueId, userId),
  ])
  if (!league || league.closedAt || !membership)
    throw new LeagueNotFoundError('liga não encontrada')
  return { league, membership }
}

// Ação de dono: a liga precisa estar aberta e a pessoa ser a dona.
export async function loadLeagueForOwner(
  leagues: LeagueRepository,
  leagueId: string,
  userId: string,
): Promise<League> {
  const { league } = await loadLeagueForMember(leagues, leagueId, userId)
  if (league.ownerId !== userId)
    throw new NotLeagueOwnerError('só quem criou a liga pode fazer isso')
  return league
}
