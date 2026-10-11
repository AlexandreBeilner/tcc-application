import { assertOptionBelongs, type AssemblyParams } from '../../domain/assembly'
import { VoteDeniedError } from '../../domain/errors'
import { denialMessage } from '../../domain/voting'
import type { AssemblyRepository } from '../ports/assemblyRepository'
import type { VoteAccessService } from '../voteAccessService'

export interface CastVoteInput {
  assemblyId: string
  userId: string
  optionId: string
}

export interface CastVoteOutcome {
  // Trocou um voto que já existia (voto novo = false).
  changed: boolean
  // O voto novo gastou o crédito gratuito do mês.
  creditConsumed: boolean
}

// Vota ou troca o voto. Exige posição na data de corte (nunca bot: o motor já tira os bots do
// snapshot) e, para voto novo, plano PRO **ou** crédito do mês (e-mail verificado e nível mínimo).
// Trocar o voto até o fechamento não pede nada nem consome outro crédito. A gravação, o consumo do
// crédito e a janela de votação são uma transação só (ver `AssemblyRepository.castVote`).
export class CastVoteUseCase {
  constructor(
    private readonly access: VoteAccessService,
    private readonly repository: AssemblyRepository,
    private readonly params: () => AssemblyParams,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: CastVoteInput): Promise<CastVoteOutcome> {
    const now = this.now()
    const params = this.params()
    const ctx = await this.access.evaluate(input.assemblyId, input.userId, now)
    assertOptionBelongs(ctx.options, input.optionId)
    if (ctx.denial) throw new VoteDeniedError(ctx.denial, denialMessage(ctx.denial, params))

    const result = await this.repository.castVote(
      {
        assemblyId: input.assemblyId,
        userId: input.userId,
        optionId: input.optionId,
        credit: ctx.needsCredit
          ? { monthKey: ctx.monthKey, monthlyFreeCredits: params.monthlyFreeCredits }
          : undefined,
      },
      now,
    )
    if (result.status === 'closed') {
      throw new VoteDeniedError('not_open', denialMessage('not_open', params))
    }
    if (result.status === 'no_credit') {
      throw new VoteDeniedError('no_credit', denialMessage('no_credit', params))
    }
    return { changed: result.changed, creditConsumed: result.creditConsumed }
  }
}
