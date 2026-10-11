import {
  creditMonthKey,
  type AgendaOption,
  type Assembly,
  type AssemblyParams,
  type Vote,
} from '../domain/assembly'
import { AssemblyNotFoundError } from '../domain/errors'
import { resolveVoteAccess, type VoteDenial } from '../domain/voting'
import type { AssemblyKindRegistry } from './assemblyKinds'
import type { AssemblyRepository } from './ports/assemblyRepository'
import type { HoldingsSnapshotProvider } from './ports/holdingsSnapshotProvider'
import type { ProStatusReader } from './ports/proStatusReader'
import type { VoterProfileReader } from './ports/voterProfileReader'

export interface VoteAccess {
  assembly: Assembly
  options: AgendaOption[]
  denial: VoteDenial | null
  isPro: boolean
  vote: Vote | null
  // Ações da pessoa na data de corte (só dela; nunca valor em reais). Nulo antes do snapshot.
  weight: number | null
  monthKey: string
  creditsUsed: number
  // Voto novo de quem não é PRO: consome o crédito do mês.
  needsCredit: boolean
}

// Junta os fatos de uma pessoa numa assembleia e aplica `resolveVoteAccess`. Serve ao voto e à
// leitura "minha situação", para a regra viver num lugar só. Só busca o que a decisão precisa.
export class VoteAccessService {
  constructor(
    private readonly kinds: AssemblyKindRegistry,
    private readonly repository: AssemblyRepository,
    private readonly snapshots: HoldingsSnapshotProvider,
    private readonly pro: ProStatusReader,
    private readonly voters: VoterProfileReader,
    private readonly params: () => AssemblyParams,
  ) {}

  async evaluate(assemblyId: string, userId: string, now: Date): Promise<VoteAccess> {
    const found = await this.repository.findById(assemblyId)
    if (!found) throw new AssemblyNotFoundError()
    const { assembly, options } = found
    const params = this.params()
    const monthKey = creditMonthKey(now)
    const open = assembly.status === 'open' && now >= assembly.opensAt && now < assembly.closesAt
    const base = { assembly, options, monthKey, weight: null }

    const [vote, creditsUsed] = await Promise.all([
      this.repository.findVote(assemblyId, userId),
      this.repository.countCreditsUsed(userId, monthKey),
    ])
    if (!open) {
      return { ...base, vote, creditsUsed, denial: 'not_open', isPro: false, needsCredit: false }
    }
    const { policies } = this.kinds.get(assembly.kind)
    const snapshot = await this.snapshots.get(assembly)
    const eligible = policies.isEligible(userId, snapshot)
    const weight = eligible ? policies.weightOf(userId, snapshot) : 0
    const isPro = await this.pro.isPro(userId)

    // Perfil e saldo só pesam para quem ainda vai gastar crédito.
    const needsProfile = eligible && !vote && !isPro
    const profile = needsProfile
      ? await this.voters.get(userId)
      : { level: 0, emailVerified: false }

    const denial = resolveVoteAccess(
      {
        open,
        eligible,
        hasVoted: vote !== null,
        isPro,
        emailVerified: profile.emailVerified,
        level: profile.level,
        creditsUsedThisMonth: creditsUsed,
      },
      params,
    )
    return {
      ...base,
      vote,
      weight,
      creditsUsed,
      denial,
      isPro,
      needsCredit: needsProfile && denial === null,
    }
  }
}
