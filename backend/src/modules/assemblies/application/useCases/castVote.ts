import { assertOptionBelongs } from '../../domain/assembly'
import { VoteDeniedError } from '../../domain/errors'
import { denialMessage } from '../../domain/voting'
import type { AssemblyRepository } from '../ports/assemblyRepository'
import type { ParticipationRewards } from '../ports/resultPublishers'
import type { VoteAccessService } from '../voteAccessService'

export interface CastVoteInput {
  assemblyId: string
  userId: string
  optionId: string
}

export interface CastVoteOutcome {
  // Trocou um voto que já existia (voto novo = false).
  changed: boolean
}

// Vota ou troca o voto. Exige posição na data de corte (nunca bot: o motor já tira os bots do
// snapshot). Trocar o voto até o fechamento não pede nada. A gravação e a janela de votação são
// uma transação só (ver `AssemblyRepository.castVote`).
export class CastVoteUseCase {
  constructor(
    private readonly access: VoteAccessService,
    private readonly repository: AssemblyRepository,
    private readonly now: () => Date = () => new Date(),
    private readonly rewards?: ParticipationRewards,
  ) {}

  async execute(input: CastVoteInput): Promise<CastVoteOutcome> {
    const now = this.now()
    const ctx = await this.access.evaluate(input.assemblyId, input.userId, now)
    assertOptionBelongs(ctx.options, input.optionId)
    if (ctx.denial) throw new VoteDeniedError(ctx.denial, denialMessage(ctx.denial))

    const result = await this.repository.castVote(
      {
        assemblyId: input.assemblyId,
        userId: input.userId,
        optionId: input.optionId,
      },
      now,
    )
    if (result.status === 'closed') {
      throw new VoteDeniedError('not_open', denialMessage('not_open'))
    }
    // XP só por participar: o primeiro voto da pessoa nesta assembleia, nunca a troca de voto e
    // nunca em função de quem venceu. Best-effort: o voto já está gravado.
    if (!result.changed) {
      try {
        await this.rewards?.rewardFirstVote(input.userId, input.assemblyId)
      } catch (err) {
        console.error(`assembleias: falha ao conceder o XP de participação a ${input.userId}`, err)
      }
    }
    return { changed: result.changed }
  }
}
