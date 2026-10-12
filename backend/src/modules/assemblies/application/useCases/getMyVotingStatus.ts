import type { AssemblyParams } from '../../domain/assembly'
import { denialMessage, type VoteDenial } from '../../domain/voting'
import type { VoteAccessService } from '../voteAccessService'

export interface MyVotingStatus {
  assemblyId: string
  isPro: boolean
  canVote: boolean
  // Por que não pode (ou `null`); `message` é o texto pronto, sem culpa.
  reason: VoteDenial | null
  message: string | null
  myVote: { optionId: string } | null
  // Minhas ações na data de corte. Só da própria pessoa, nunca valor em reais.
  myShares: number | null
  // Saldo do crédito gratuito no mês (para quem não é PRO).
  credit: {
    monthKey: string
    limit: number
    used: number
    available: number
    minLevel: number
  }
}

// "Minha situação" numa assembleia: o que a tela da 6.6 precisa para mostrar o botão de voto, o
// saldo de crédito e o convite ao PRO sem decidir regra no frontend.
export class GetMyVotingStatusUseCase {
  constructor(
    private readonly access: VoteAccessService,
    private readonly params: () => AssemblyParams,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: { assemblyId: string; userId: string }): Promise<MyVotingStatus> {
    const params = this.params()
    const ctx = await this.access.evaluate(input.assemblyId, input.userId, this.now())
    return {
      assemblyId: input.assemblyId,
      isPro: ctx.isPro,
      canVote: ctx.denial === null,
      reason: ctx.denial,
      message: ctx.denial ? denialMessage(ctx.denial, params) : null,
      myVote: ctx.vote ? { optionId: ctx.vote.optionId } : null,
      myShares: ctx.weight,
      credit: {
        monthKey: ctx.monthKey,
        limit: params.monthlyFreeCredits,
        used: ctx.creditsUsed,
        available: Math.max(0, params.monthlyFreeCredits - ctx.creditsUsed),
        minLevel: params.freeCreditMinLevel,
      },
    }
  }
}
