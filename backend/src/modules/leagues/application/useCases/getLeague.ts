import type { CosmeticsReader, PublicCosmetics } from '../../../../shared/publicCosmetics'
import { NO_COSMETICS } from '../../../../shared/publicCosmetics'
import { isLeagueArchived } from '../../domain/league'
import { loadLeagueForMember } from '../leagueAccess'
import type { LeagueRepository } from '../ports/leagueRepository'
import type { LeagueScoreReader } from '../ports/leagueScoreReader'
import type { LeagueUserDirectory } from '../ports/leagueUserDirectory'
import type { ProMembershipReader } from '../ports/proMembershipReader'
import type { LeagueSummary } from './listMyLeagues'

export interface StandingRow {
  position: number
  userId: string
  username: string
  name: string
  avatarUrl: string | null
  level: number
  // Só percentual da janela. `null` quando não foi possível pontuar a pessoa agora.
  profitabilityPct: number | null
  isYou: boolean
  cosmetics: PublicCosmetics
}

export interface PendingInvite {
  userId: string
  username: string
}

export interface LeagueDetail {
  league: LeagueSummary
  // Vazio para quem só foi convidado: primeiro aceita, depois vê a disputa.
  standings: StandingRow[]
  // Só o dono vê quem ainda não respondeu.
  pendingInvites: PendingInvite[]
  // Quando o ranking de base foi calculado; `null` se foi calculado na hora.
  updatedAt: string | null
}

// Detalhe e classificação de uma liga. A pontuação é a rentabilidade percentual da janela do
// ranking oficial entre os membros ativos; nunca patrimônio absoluto (RNF09). Liga arquivada
// continua visível: cancelar o PRO nunca esconde o que já existe.
export class GetLeagueUseCase {
  constructor(
    private readonly leagues: LeagueRepository,
    private readonly scores: LeagueScoreReader,
    private readonly membership: ProMembershipReader,
    private readonly users: LeagueUserDirectory,
    private readonly cosmeticsReader?: CosmeticsReader,
  ) {}

  async execute(input: { userId: string; leagueId: string }): Promise<LeagueDetail> {
    const { league, membership } = await loadLeagueForMember(
      this.leagues,
      input.leagueId,
      input.userId,
    )
    const members = await this.leagues.listMembers(league.id)
    const active = members.filter((m) => m.status === 'active')
    const invited = members.filter((m) => m.status === 'invited')
    const isOwner = league.ownerId === input.userId

    const [proOwners, people] = await Promise.all([
      this.membership.listProUserIds([league.ownerId]),
      this.users.findByIds(members.map((m) => m.userId)),
    ])
    const person = new Map(people.map((p) => [p.id, p]))

    const summary: LeagueSummary = {
      id: league.id,
      name: league.name,
      window: league.window,
      ownerId: league.ownerId,
      ownerUsername: person.get(league.ownerId)?.username ?? '',
      isOwner,
      status: membership.status,
      archived: isLeagueArchived(proOwners.has(league.ownerId)),
      memberCount: active.length,
    }

    let standings: StandingRow[] = []
    let updatedAt: string | null = null
    if (membership.status === 'active') {
      const ranked = await this.scores.rank(
        active.map((m) => m.userId),
        league.window,
      )
      updatedAt = ranked.updatedAt?.toISOString() ?? null
      const levelById = new Map(ranked.scores.map((s) => [s.userId, s]))
      const scoredIds = new Set(ranked.scores.map((s) => s.userId))
      // Quem não pôde ser pontuado agora aparece no fim, sem número, em vez de sumir.
      const orderedIds = [
        ...ranked.scores.map((s) => s.userId),
        ...active.map((m) => m.userId).filter((id) => !scoredIds.has(id)),
      ]
      const displays =
        (await this.cosmeticsReader?.findDisplays(orderedIds)) ?? new Map<string, PublicCosmetics>()
      standings = orderedIds.map((userId, index) => {
        const who = person.get(userId)
        const score = levelById.get(userId)
        return {
          position: index + 1,
          userId,
          username: who?.username ?? '',
          name: who?.name ?? '',
          avatarUrl: who?.avatarUrl ?? null,
          level: score?.level ?? 0,
          profitabilityPct: score?.profitabilityPct ?? null,
          isYou: userId === input.userId,
          cosmetics: displays.get(userId) ?? NO_COSMETICS,
        }
      })
    }

    return {
      league: summary,
      standings,
      pendingInvites: isOwner
        ? invited.map((m) => ({ userId: m.userId, username: person.get(m.userId)?.username ?? '' }))
        : [],
      updatedAt,
    }
  }
}
