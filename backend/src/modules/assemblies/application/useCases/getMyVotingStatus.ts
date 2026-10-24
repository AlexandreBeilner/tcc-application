import { denialMessage, type VoteDenial } from '../../domain/voting'
import type { VoteAccessService } from '../voteAccessService'

export interface MyVotingStatus {
  assemblyId: string
  canVote: boolean
  // Por que não pode (ou `null`); `message` é o texto pronto, sem culpa.
  reason: VoteDenial | null
  message: string | null
  myVote: { optionId: string } | null
  // Minhas ações na data de corte. Só da própria pessoa, nunca valor em reais.
  myShares: number | null
}

// "Minha situação" numa assembleia: o que a tela da 6.6 precisa para mostrar o botão de voto sem
// decidir regra no frontend.
export class GetMyVotingStatusUseCase {
  constructor(
    private readonly access: VoteAccessService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: { assemblyId: string; userId: string }): Promise<MyVotingStatus> {
    const ctx = await this.access.evaluate(input.assemblyId, input.userId, this.now())
    return {
      assemblyId: input.assemblyId,
      canVote: ctx.denial === null,
      reason: ctx.denial,
      message: ctx.denial ? denialMessage(ctx.denial) : null,
      myVote: ctx.vote ? { optionId: ctx.vote.optionId } : null,
      myShares: ctx.weight,
    }
  }
}
