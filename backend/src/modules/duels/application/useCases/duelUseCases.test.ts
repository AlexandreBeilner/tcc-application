import { describe, expect, it } from 'vitest'
import { DUEL_PARTICIPATION_XP } from '../../domain/duel'
import {
  DuelAlreadyOpenError,
  DuelNotFoundError,
  DuelNotPendingError,
  NotDuelChallengerError,
  NotDuelOpponentError,
  NotFriendsError,
  SelfDuelError,
  TooManyDuelsError,
} from '../../domain/errors'
import { createFakeDuelRepository } from '../../test/fakes/fakeDuelRepository'
import {
  createFakeFeed,
  createFakeFriendships,
  createFakePerformance,
  createFakeProAccess,
  createFakeUsers,
  createFakeXp,
} from '../../test/fakes/fakes'
import { CancelDuelUseCase } from './cancelDuel'
import { CreateDuelUseCase } from './createDuel'
import { GetDuelUseCase } from './getDuel'
import { ListMyDuelsUseCase } from './listMyDuels'
import { RespondToDuelUseCase } from './respondToDuel'
import { SettleDueDuelsUseCase } from './settleDueDuels'

const T0 = new Date('2026-10-10T12:00:00Z')
const DAY = 24 * 60 * 60 * 1000

function build(
  options: { pro?: string[]; perf?: Record<string, { returnPct: number; operated: boolean }> } = {},
) {
  let clock = T0
  const now = () => clock
  const duels = createFakeDuelRepository()
  const access = createFakeProAccess(options.pro ?? ['ana'])
  const friendships = createFakeFriendships([
    ['ana', 'bia'],
    ['ana', 'caio'],
    ['ana', 'dani'],
    ['ana', 'edu'],
    ['bia', 'caio'],
  ])
  const users = createFakeUsers(['ana', 'bia', 'caio', 'dani', 'edu'])
  const performance = createFakePerformance(options.perf ?? {})
  const xp = createFakeXp()
  const feed = createFakeFeed()
  return {
    duels,
    performance,
    xp,
    feed,
    advance: (ms: number) => {
      clock = new Date(clock.getTime() + ms)
    },
    create: new CreateDuelUseCase(access, duels, friendships, now),
    respond: new RespondToDuelUseCase(duels, now),
    cancel: new CancelDuelUseCase(duels, now),
    list: new ListMyDuelsUseCase(duels, users),
    get: new GetDuelUseCase(duels, performance, users, undefined, now),
    settle: new SettleDueDuelsUseCase(duels, performance, users, xp, feed, now),
    access,
  }
}

describe('criar e responder', () => {
  it('PRO desafia um amigo; o desafiado (sem PRO) aceita e o duelo dura 7 dias a partir do aceite', async () => {
    const ctx = build()
    const duel = await ctx.create.execute({ userId: 'ana', opponentId: 'bia' })
    expect(duel.status).toBe('pending')
    ctx.advance(DAY)
    await ctx.respond.execute({ userId: 'bia', duelId: duel.id, accept: true })

    const active = (await ctx.duels.findById(duel.id))!
    expect(active.status).toBe('active')
    expect(active.startsAt).toEqual(new Date(T0.getTime() + DAY))
    expect(active.endsAt).toEqual(new Date(T0.getTime() + 8 * DAY))
  })

  it('desafiar sem PRO responde requer plano PRO e não grava nada', async () => {
    const ctx = build({ pro: [] })
    await expect(ctx.create.execute({ userId: 'ana', opponentId: 'bia' })).rejects.toMatchObject({
      code: 'PRO_REQUIRED',
    })
    expect(ctx.duels.duels.size).toBe(0)
  })

  it('só amigo, nunca a si mesmo, e nunca dois em aberto com a mesma pessoa', async () => {
    const ctx = build()
    await expect(ctx.create.execute({ userId: 'ana', opponentId: 'ana' })).rejects.toBeInstanceOf(
      SelfDuelError,
    )
    await expect(ctx.create.execute({ userId: 'ana', opponentId: 'zeca' })).rejects.toBeInstanceOf(
      NotFriendsError,
    )
    await ctx.create.execute({ userId: 'ana', opponentId: 'bia' })
    await expect(ctx.create.execute({ userId: 'ana', opponentId: 'bia' })).rejects.toBeInstanceOf(
      DuelAlreadyOpenError,
    )
  })

  it('no máximo 3 duelos simultâneos para quem desafia; encerrar libera a vaga', async () => {
    const ctx = build()
    const first = await ctx.create.execute({ userId: 'ana', opponentId: 'bia' })
    await ctx.create.execute({ userId: 'ana', opponentId: 'caio' })
    await ctx.create.execute({ userId: 'ana', opponentId: 'dani' })
    await expect(ctx.create.execute({ userId: 'ana', opponentId: 'edu' })).rejects.toBeInstanceOf(
      TooManyDuelsError,
    )
    await ctx.cancel.execute({ userId: 'ana', duelId: first.id })
    await expect(ctx.create.execute({ userId: 'ana', opponentId: 'edu' })).resolves.toBeTruthy()
  })

  it('o desafiado também não passa de 3 em andamento ao aceitar', async () => {
    const ctx = build({ pro: ['ana', 'bia', 'caio', 'dani', 'edu'] })
    // bia (desafiada por 4 pessoas) só consegue ter 3 ativos
    const friendships = createFakeFriendships([
      ['bia', 'ana'],
      ['bia', 'caio'],
      ['bia', 'dani'],
      ['bia', 'edu'],
    ])
    const create = new CreateDuelUseCase(ctx.access, ctx.duels, friendships, () => T0)
    const ids: string[] = []
    for (const challenger of ['ana', 'caio', 'dani', 'edu']) {
      ids.push((await create.execute({ userId: challenger, opponentId: 'bia' })).id)
    }
    for (const id of ids.slice(0, 3)) {
      await ctx.respond.execute({ userId: 'bia', duelId: id, accept: true })
    }
    await expect(
      ctx.respond.execute({ userId: 'bia', duelId: ids[3], accept: true }),
    ).rejects.toBeInstanceOf(TooManyDuelsError)
    // recusar continua possível
    await ctx.respond.execute({ userId: 'bia', duelId: ids[3], accept: false })
    expect((await ctx.duels.findById(ids[3]))?.status).toBe('declined')
  })

  it('só o desafiado responde; só quem desafiou cancela; estranho recebe não encontrado', async () => {
    const ctx = build()
    const duel = await ctx.create.execute({ userId: 'ana', opponentId: 'bia' })
    await expect(
      ctx.respond.execute({ userId: 'ana', duelId: duel.id, accept: true }),
    ).rejects.toBeInstanceOf(NotDuelOpponentError)
    await expect(ctx.cancel.execute({ userId: 'bia', duelId: duel.id })).rejects.toBeInstanceOf(
      NotDuelChallengerError,
    )
    await expect(
      ctx.respond.execute({ userId: 'caio', duelId: duel.id, accept: true }),
    ).rejects.toBeInstanceOf(DuelNotFoundError)
  })

  it('desafio vencido não pode mais ser aceito e duelo em andamento não se cancela', async () => {
    const ctx = build()
    const duel = await ctx.create.execute({ userId: 'ana', opponentId: 'bia' })
    ctx.advance(8 * DAY)
    await expect(
      ctx.respond.execute({ userId: 'bia', duelId: duel.id, accept: true }),
    ).rejects.toBeInstanceOf(DuelNotPendingError)

    const ctx2 = build()
    const d2 = await ctx2.create.execute({ userId: 'ana', opponentId: 'bia' })
    await ctx2.respond.execute({ userId: 'bia', duelId: d2.id, accept: true })
    await expect(ctx2.cancel.execute({ userId: 'ana', duelId: d2.id })).rejects.toBeInstanceOf(
      DuelNotPendingError,
    )
  })
})

async function startedDuel(ctx: ReturnType<typeof build>) {
  const duel = await ctx.create.execute({ userId: 'ana', opponentId: 'bia' })
  await ctx.respond.execute({ userId: 'bia', duelId: duel.id, accept: true })
  return duel
}

describe('encerramento', () => {
  it('antes do fim nada acontece; no fim, vence a maior rentabilidade e ambos ganham XP igual', async () => {
    const ctx = build({
      perf: { ana: { returnPct: 4, operated: true }, bia: { returnPct: 9, operated: true } },
    })
    const duel = await startedDuel(ctx)

    ctx.advance(6 * DAY)
    expect(await ctx.settle.execute()).toMatchObject({ finished: 0 })

    ctx.advance(DAY + 1000)
    const summary = await ctx.settle.execute()
    expect(summary.finished).toBe(1)

    const done = (await ctx.duels.findById(duel.id))!
    expect(done).toMatchObject({ status: 'finished', outcome: 'opponent', reason: 'profitability' })
    expect(done.challengerPct).toBe(4)
    expect(done.opponentPct).toBe(9)
    // medido nos instantes de início e fim do duelo
    expect(ctx.performance.calls[0]).toMatchObject({ from: done.startsAt, to: done.endsAt })
    // XP só por participar: igual para quem ganhou e quem perdeu
    expect(ctx.xp.grants.map((g) => [g.userId, g.amount])).toEqual([
      ['ana', DUEL_PARTICIPATION_XP],
      ['bia', DUEL_PARTICIPATION_XP],
    ])
    // feed: só a pessoa que venceu
    expect(ctx.feed.items).toHaveLength(1)
    expect(ctx.feed.items[0]).toMatchObject({ userId: 'bia', kind: 'won', opponentUsername: 'ana' })
  })

  it('empate: ninguém é declarado vencedor e o feed registra empate uma vez', async () => {
    const ctx = build({
      perf: { ana: { returnPct: 3, operated: true }, bia: { returnPct: 3.001, operated: true } },
    })
    const duel = await startedDuel(ctx)
    ctx.advance(8 * DAY)
    await ctx.settle.execute()

    expect(await ctx.duels.findById(duel.id)).toMatchObject({ outcome: 'draw', reason: 'tie' })
    expect(ctx.feed.items).toEqual([expect.objectContaining({ userId: 'ana', kind: 'draw' })])
  })

  it('abandono: quem não operou perde, não ganha XP e o feed celebra só o vencedor', async () => {
    const ctx = build({
      perf: { ana: { returnPct: -7, operated: true }, bia: { returnPct: 0, operated: false } },
    })
    const duel = await startedDuel(ctx)
    ctx.advance(8 * DAY)
    await ctx.settle.execute()

    expect(await ctx.duels.findById(duel.id)).toMatchObject({
      outcome: 'challenger',
      reason: 'abandonment',
    })
    expect(ctx.xp.grants.map((g) => g.userId)).toEqual(['ana'])
    expect(ctx.feed.items).toEqual([
      expect.objectContaining({ userId: 'ana', kind: 'won', reason: 'abandonment' }),
    ])
  })

  it('os dois sem operar: empate, sem XP e sem item no feed', async () => {
    const ctx = build()
    const duel = await startedDuel(ctx)
    ctx.advance(8 * DAY)
    await ctx.settle.execute()

    expect(await ctx.duels.findById(duel.id)).toMatchObject({
      outcome: 'draw',
      reason: 'both_inactive',
    })
    expect(ctx.xp.grants).toEqual([])
    expect(ctx.feed.items).toEqual([])
    expect((await ctx.duels.findById(duel.id))?.xpAwardedAt).not.toBeNull()
  })

  it('quem cancelou o PRO no meio do duelo termina o duelo normalmente', async () => {
    const ctx = build({
      perf: { ana: { returnPct: 5, operated: true }, bia: { returnPct: 1, operated: true } },
    })
    const duel = await startedDuel(ctx)
    ctx.access.ids.delete('ana')
    ctx.advance(8 * DAY)
    await ctx.settle.execute()
    expect(await ctx.duels.findById(duel.id)).toMatchObject({
      status: 'finished',
      outcome: 'challenger',
    })
  })

  it('é idempotente: rodar de novo não repete resultado, XP nem feed', async () => {
    const ctx = build({
      perf: { ana: { returnPct: 4, operated: true }, bia: { returnPct: 9, operated: true } },
    })
    await startedDuel(ctx)
    ctx.advance(8 * DAY)
    await ctx.settle.execute()
    const again = await ctx.settle.execute()

    expect(again).toMatchObject({ finished: 0, xpGranted: 0 })
    expect(ctx.xp.grants).toHaveLength(2)
    expect(ctx.feed.items).toHaveLength(1)
  })

  it('falha ao medir deixa o duelo ativo para a próxima rodada', async () => {
    const ctx = build({
      perf: { ana: { returnPct: 4, operated: true }, bia: { returnPct: 9, operated: true } },
    })
    const duel = await startedDuel(ctx)
    ctx.advance(8 * DAY)
    ctx.performance.failFor.add('bia')

    const first = await ctx.settle.execute()
    expect(first).toMatchObject({ finished: 0, failed: 1 })
    expect((await ctx.duels.findById(duel.id))?.status).toBe('active')

    ctx.performance.failFor.clear()
    expect((await ctx.settle.execute()).finished).toBe(1)
  })

  it('XP que falhou depois do resultado é creditado na rodada seguinte, sem refazer o resultado', async () => {
    const ctx = build({
      perf: { ana: { returnPct: 4, operated: true }, bia: { returnPct: 9, operated: true } },
    })
    const duel = await startedDuel(ctx)
    ctx.advance(8 * DAY)
    const realAward = ctx.xp.award
    ctx.xp.award = async () => {
      throw new Error('gamificação fora do ar')
    }
    await ctx.settle.execute()
    expect((await ctx.duels.findById(duel.id))?.status).toBe('finished')
    expect(ctx.xp.grants).toHaveLength(0)

    ctx.xp.award = realAward
    const retry = await ctx.settle.execute()
    expect(retry.xpGranted).toBe(2)
    expect(ctx.feed.items).toHaveLength(1)
  })

  it('desafio sem resposta expira e libera a vaga', async () => {
    const ctx = build()
    const duel = await ctx.create.execute({ userId: 'ana', opponentId: 'bia' })
    ctx.advance(8 * DAY)
    expect((await ctx.settle.execute()).expired).toBe(1)
    expect((await ctx.duels.findById(duel.id))?.status).toBe('expired')
  })
})

describe('listar e detalhar', () => {
  it('lista com o outro lado e o resultado visto por cada pessoa', async () => {
    const ctx = build({
      perf: { ana: { returnPct: 4, operated: true }, bia: { returnPct: 9, operated: true } },
    })
    await startedDuel(ctx)
    ctx.advance(8 * DAY)
    await ctx.settle.execute()

    const [forAna] = await ctx.list.execute('ana')
    const [forBia] = await ctx.list.execute('bia')
    expect(forAna).toMatchObject({
      role: 'challenger',
      result: 'lost',
      opponent: { username: 'bia' },
    })
    expect(forAna.you).toEqual({ returnPct: 4, operated: true })
    expect(forAna.them).toEqual({ returnPct: 9, operated: true })
    expect(forBia).toMatchObject({ role: 'opponent', result: 'won' })
    expect(forBia.you?.returnPct).toBe(9)
  })

  it('detalhe de duelo em andamento traz o placar parcial; fora do ar não derruba a tela', async () => {
    const ctx = build({
      perf: { ana: { returnPct: 2, operated: true }, bia: { returnPct: 1, operated: false } },
    })
    const duel = await startedDuel(ctx)
    ctx.advance(2 * DAY)
    const live = await ctx.get.execute({ userId: 'ana', duelId: duel.id })
    expect(live.you).toEqual({ returnPct: 2, operated: true })
    expect(live.them).toEqual({ returnPct: 1, operated: false })

    ctx.performance.failFor.add('bia')
    const degraded = await ctx.get.execute({ userId: 'ana', duelId: duel.id })
    expect(degraded.you).toBeNull()
  })

  it('estranho não vê o duelo', async () => {
    const ctx = build()
    const duel = await ctx.create.execute({ userId: 'ana', opponentId: 'bia' })
    await expect(ctx.get.execute({ userId: 'caio', duelId: duel.id })).rejects.toBeInstanceOf(
      DuelNotFoundError,
    )
  })
})
