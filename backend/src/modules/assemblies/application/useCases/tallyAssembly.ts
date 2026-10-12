import { tallyVotes, type AssemblyParams, type Tally } from '../../domain/assembly'
import { AssemblyNotFoundError } from '../../domain/errors'
import type { AssemblyKindRegistry } from '../assemblyKinds'
import type { AssemblyRepository } from '../ports/assemblyRepository'
import type { HoldingsSnapshotProvider } from '../ports/holdingsSnapshotProvider'

// Apura os votos de uma assembleia (sem gravar nada): usa o snapshot da data de corte e as
// políticas do kind. Serve tanto ao placar ao vivo quanto ao fechamento (MO.6.3).
export class TallyAssemblyUseCase {
  constructor(
    private readonly kinds: AssemblyKindRegistry,
    private readonly repository: AssemblyRepository,
    private readonly snapshots: HoldingsSnapshotProvider,
    private readonly params: () => Pick<AssemblyParams, 'minVoters'>,
  ) {}

  async execute(assemblyId: string): Promise<Tally> {
    const found = await this.repository.findById(assemblyId)
    if (!found) throw new AssemblyNotFoundError()
    const { policies } = this.kinds.get(found.assembly.kind)
    const [votes, snapshot] = await Promise.all([
      this.repository.listVotes(assemblyId),
      this.snapshots.get(found.assembly),
    ])
    // O quórum é o da abertura: mudar o parâmetro no painel vale só para as próximas assembleias.
    const minVoters = found.assembly.minVoters ?? this.params().minVoters
    return tallyVotes(found.options, votes, snapshot, policies, { minVoters })
  }
}
