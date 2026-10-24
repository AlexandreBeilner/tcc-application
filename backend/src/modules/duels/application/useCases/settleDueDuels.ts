import type { Duel } from '../../domain/duel'
import { decideDuel, DUEL_PARTICIPATION_XP } from '../../domain/duel'
import type { DuelPerformanceReader } from '../ports/duelPerformanceReader'
import type { DuelRepository } from '../ports/duelRepository'
import type { DuelFeedRecorder, XpGrant } from '../ports/duelSideEffects'
import type { DuelUserDirectory } from '../ports/duelUserDirectory'

export interface SettleSummary {
  finished: number
  expired: number
  xpGranted: number
  failed: number
}

const XP_CATCH_UP_BATCH = 100

// Job periódico dos duelos (MO.5.3): encerra os que chegaram ao fim, expira desafios sem resposta
// e credita o XP de participação. Idempotente em todos os passos: rodar duas vezes (ou dois
// processos juntos) não duplica resultado, feed nem XP. Um duelo que não deu para medir agora
// (motor fora do ar) fica como está e é tentado de novo na próxima rodada.
//
// O resultado é medido nos instantes de início e fim do duelo (replay do log), então é o mesmo
// seja qual for a hora em que o job rode.
export class SettleDueDuelsUseCase {
  constructor(
    private readonly duels: DuelRepository,
    private readonly performance: DuelPerformanceReader,
    private readonly users: DuelUserDirectory,
    private readonly xp: XpGrant,
    private readonly feed: DuelFeedRecorder,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(): Promise<SettleSummary> {
    const now = this.now()
    const summary: SettleSummary = { finished: 0, expired: 0, xpGranted: 0, failed: 0 }

    for (const duel of await this.duels.listExpiredPending(now)) {
      if (await this.duels.expire(duel.id, now)) summary.expired += 1
    }

    for (const duel of await this.duels.listDueActive(now)) {
      try {
        if (await this.settle(duel, now)) summary.finished += 1
      } catch (err) {
        summary.failed += 1
        console.error(`duelos: não foi possível encerrar o duelo ${duel.id} agora:`, err)
      }
    }

    // Rede de segurança: encerrados cujo XP ainda não foi creditado (falha entre as duas etapas).
    for (const duel of await this.duels.listFinishedWithoutXp(XP_CATCH_UP_BATCH)) {
      try {
        summary.xpGranted += await this.grantXp(duel, now)
      } catch (err) {
        summary.failed += 1
        console.error(`duelos: não foi possível creditar o XP do duelo ${duel.id}:`, err)
      }
    }
    return summary
  }

  private async settle(duel: Duel, now: Date): Promise<boolean> {
    if (!duel.startsAt || !duel.endsAt) return false
    const [challenger, opponent] = await Promise.all([
      this.performance.measure(duel.challengerId, duel.startsAt, duel.endsAt),
      this.performance.measure(duel.opponentId, duel.startsAt, duel.endsAt),
    ])
    const decision = decideDuel(challenger, opponent)
    const won = await this.duels.finish(
      duel.id,
      {
        ...decision,
        challengerPct: challenger.returnPct,
        opponentPct: opponent.returnPct,
        challengerOperated: challenger.operated,
        opponentOperated: opponent.operated,
      },
      now,
    )
    // Outro processo já encerrou: nada de feed nem XP em dobro.
    if (!won) return false

    await this.recordFeed(duel, decision)
    await this.grantXp(
      {
        ...duel,
        challengerOperated: challenger.operated,
        opponentOperated: opponent.operated,
      },
      now,
    ).catch((err) =>
      console.error(`duelos: XP do duelo ${duel.id} fica para a próxima rodada:`, err),
    )
    return true
  }

  // O feed celebra: só quem venceu (ou quem desafiou, no empate) vira item, e empate de quem não
  // jogou não vira item nenhum.
  private async recordFeed(
    duel: Duel,
    decision: {
      outcome: 'challenger' | 'opponent' | 'draw'
      reason: 'profitability' | 'abandonment' | 'tie' | 'both_inactive'
    },
  ): Promise<void> {
    if (decision.reason === 'both_inactive') return
    const subjectId = decision.outcome === 'opponent' ? duel.opponentId : duel.challengerId
    const otherId = subjectId === duel.challengerId ? duel.opponentId : duel.challengerId
    try {
      const people = await this.users.findByIds([otherId])
      const other = people.find((p) => p.id === otherId)
      await this.feed.recordResult({
        userId: subjectId,
        kind: decision.outcome === 'draw' ? 'draw' : 'won',
        duelId: duel.id,
        opponentUsername: other?.username ?? '',
        opponentName: other?.name ?? '',
        reason: decision.reason,
      })
    } catch (err) {
      console.error(`duelos: não foi possível registrar o duelo ${duel.id} no feed:`, err)
    }
  }

  // XP fixo de participação para quem operou durante o duelo; quem abandonou não ganha.
  private async grantXp(duel: Duel, now: Date): Promise<number> {
    let granted = 0
    const participants: [string, boolean | null][] = [
      [duel.challengerId, duel.challengerOperated],
      [duel.opponentId, duel.opponentOperated],
    ]
    for (const [userId, operated] of participants) {
      if (!operated) continue
      await this.xp.award(userId, DUEL_PARTICIPATION_XP, `duel:${duel.id}`)
      granted += 1
    }
    await this.duels.markXpAwarded(duel.id, now)
    return granted
  }
}
