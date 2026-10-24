import type { AgendaOption, Assembly, Vote } from '../domain/assembly'
import { AssemblyNotFoundError } from '../domain/errors'
import { resolveVoteAccess, type VoteDenial } from '../domain/voting'
import type { AssemblyKindRegistry } from './assemblyKinds'
import type { AssemblyRepository } from './ports/assemblyRepository'
import type { HoldingsSnapshotProvider } from './ports/holdingsSnapshotProvider'

export interface VoteAccess {
  assembly: Assembly
  options: AgendaOption[]
  denial: VoteDenial | null
  vote: Vote | null
  // Ações da pessoa na data de corte (só dela; nunca valor em reais). Nulo antes do snapshot.
  weight: number | null
}

// Junta os fatos de uma pessoa numa assembleia e aplica `resolveVoteAccess`. Serve ao voto e à
// leitura "minha situação", para a regra viver num lugar só. Só busca o que a decisão precisa.
export class VoteAccessService {
  constructor(
    private readonly kinds: AssemblyKindRegistry,
    private readonly repository: AssemblyRepository,
    private readonly snapshots: HoldingsSnapshotProvider,
  ) {}

  async evaluate(assemblyId: string, userId: string, now: Date): Promise<VoteAccess> {
    const found = await this.repository.findById(assemblyId)
    if (!found) throw new AssemblyNotFoundError()
    const { assembly, options } = found
    const open = assembly.status === 'open' && now >= assembly.opensAt && now < assembly.closesAt
    const vote = await this.repository.findVote(assemblyId, userId)
    if (!open) {
      return { assembly, options, vote, weight: null, denial: 'not_open' }
    }
    const { policies } = this.kinds.get(assembly.kind)
    const snapshot = await this.snapshots.get(assembly)
    const eligible = policies.isEligible(userId, snapshot)
    const weight = eligible ? policies.weightOf(userId, snapshot) : 0
    return { assembly, options, vote, weight, denial: resolveVoteAccess({ open, eligible }) }
  }
}
