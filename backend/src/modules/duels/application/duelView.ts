import type { CosmeticsReader, PublicCosmetics } from '../../../shared/publicCosmetics'
import { NO_COSMETICS } from '../../../shared/publicCosmetics'
import type { Duel, DuelReason, DuelStatus } from '../domain/duel'
import { otherPlayer, viewerOutcome } from '../domain/duel'
import type { DuelUserDirectory } from './ports/duelUserDirectory'

export interface PlayerScore {
  // Só percentual do período (RNF09).
  returnPct: number
  operated: boolean
}

export interface DuelOpponent {
  id: string
  username: string
  name: string
  avatarUrl: string | null
  cosmetics: PublicCosmetics
}

export interface DuelView {
  id: string
  status: DuelStatus
  // Papel de quem está olhando.
  role: 'challenger' | 'opponent'
  opponent: DuelOpponent
  createdAt: string
  expiresAt: string
  startsAt: string | null
  endsAt: string | null
  finishedAt: string | null
  // Só em duelo encerrado.
  result: 'won' | 'lost' | 'draw' | null
  reason: DuelReason | null
  // Placar: o gravado no encerramento, ou o parcial ao vivo no detalhe de um duelo em andamento.
  you: PlayerScore | null
  them: PlayerScore | null
}

// Monta a visão de vários duelos de uma pessoa com os dados públicos do outro lado, em duas
// consultas fixas (usuários e cosméticos) por chamada.
export async function buildDuelViews(
  duels: Duel[],
  viewerId: string,
  users: DuelUserDirectory,
  cosmeticsReader: CosmeticsReader | undefined,
  liveScores: Map<string, { you: PlayerScore; them: PlayerScore }> = new Map(),
): Promise<DuelView[]> {
  const otherIds = [...new Set(duels.map((duel) => otherPlayer(duel, viewerId)))]
  const [people, displays] = await Promise.all([
    users.findByIds(otherIds),
    cosmeticsReader?.findDisplays(otherIds) ?? Promise.resolve(new Map<string, PublicCosmetics>()),
  ])
  const person = new Map(people.map((p) => [p.id, p]))

  return duels.map((duel) => {
    const role = duel.challengerId === viewerId ? 'challenger' : 'opponent'
    const otherId = otherPlayer(duel, viewerId)
    const who = person.get(otherId)
    const stored =
      duel.status === 'finished' && duel.challengerPct !== null && duel.opponentPct !== null
        ? mine(duel, role)
        : null
    const live = liveScores.get(duel.id)
    return {
      id: duel.id,
      status: duel.status,
      role,
      opponent: {
        id: otherId,
        username: who?.username ?? '',
        name: who?.name ?? '',
        avatarUrl: who?.avatarUrl ?? null,
        cosmetics: displays.get(otherId) ?? NO_COSMETICS,
      },
      createdAt: duel.createdAt.toISOString(),
      expiresAt: duel.expiresAt.toISOString(),
      startsAt: duel.startsAt?.toISOString() ?? null,
      endsAt: duel.endsAt?.toISOString() ?? null,
      finishedAt: duel.finishedAt?.toISOString() ?? null,
      result: viewerOutcome(duel, viewerId),
      reason: duel.reason,
      you: stored?.you ?? live?.you ?? null,
      them: stored?.them ?? live?.them ?? null,
    }
  })
}

function mine(duel: Duel, role: 'challenger' | 'opponent') {
  const challenger = {
    returnPct: duel.challengerPct as number,
    operated: duel.challengerOperated ?? false,
  }
  const opponent = {
    returnPct: duel.opponentPct as number,
    operated: duel.opponentOperated ?? false,
  }
  return role === 'challenger'
    ? { you: challenger, them: opponent }
    : { you: opponent, them: challenger }
}
