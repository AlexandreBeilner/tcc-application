import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_ASSEMBLY_PARAMS, type HoldingsSnapshot } from '../../domain/assembly'
import {
  AssemblyNotFoundError,
  InvalidAssemblyOptionError,
  VoteDeniedError,
} from '../../domain/errors'
import { SHAREHOLDER_KIND, shareholderPolicies } from '../../domain/shareholderPolicies'
import { createFakeAssemblyRepository } from '../../test/fakes/fakeAssemblyRepository'
import { AssemblyKindRegistry } from '../assemblyKinds'
import { VoteAccessService } from '../voteAccessService'
import { CastVoteUseCase } from './castVote'
import { CreateAssemblyUseCase } from './createAssembly'
import { GetMyVotingStatusUseCase } from './getMyVotingStatus'

const t0 = new Date('2026-10-10T12:00:00Z')
const DAY = 24 * 60 * 60 * 1000

async function setup() {
  let clock = t0
  const now = () => clock
  const kinds = new AssemblyKindRegistry().register(SHAREHOLDER_KIND, {
    policies: shareholderPolicies,
    effect: { apply: async () => undefined },
  })
  const repository = createFakeAssemblyRepository()
  const holdings: HoldingsSnapshot = {
    takenAt: t0,
    holdings: [
      { userId: 'ana', quantity: 30 },
      { userId: 'bia', quantity: 10 },
      { userId: 'caio', quantity: 5 },
    ],
  }
  const snapshots = { take: async () => holdings, get: vi.fn(async () => holdings) }
  const pros = new Set<string>()
  const profiles = new Map<string, { level: number; emailVerified: boolean }>()
  const profileOf = (id: string) => profiles.get(id) ?? { level: 3, emailVerified: true }
  const voters = { get: vi.fn(async (id: string) => profileOf(id)) }
  const params = { ...DEFAULT_ASSEMBLY_PARAMS }
  const rewards = {
    rewardFirstVote: vi.fn<(userId: string, assemblyId: string) => Promise<void>>(
      async () => undefined,
    ),
  }
  const access = new VoteAccessService(
    kinds,
    repository,
    snapshots,
    { isPro: async (id) => pros.has(id) },
    voters,
    () => params,
  )
  const create = new CreateAssemblyUseCase(kinds, repository, now)
  const opts = (key: string) => ({ key, label: key, gain: 'g', loss: 'l', effect: {} })
  async function open(dedupeKey: string) {
    const { assembly, options } = await create.execute({
      kind: SHAREHOLDER_KIND,
      subjectRef: 'company',
      dedupeKey,
      snapshotAt: clock,
      opensAt: clock,
      closesAt: new Date(clock.getTime() + 7 * DAY),
      effectAppliesAt: new Date(clock.getTime() + 8 * DAY),
      options: [opts('a'), opts('b')],
    })
    await repository.markOpen(assembly.id)
    return { id: assembly.id, a: options[0].id, b: options[1].id }
  }
  return {
    repository,
    pros,
    profiles,
    voters,
    params,
    open,
    rewards,
    cast: new CastVoteUseCase(access, repository, () => params, now, rewards),
    status: new GetMyVotingStatusUseCase(access, () => params, now),
    advance: (ms: number) => (clock = new Date(clock.getTime() + ms)),
  }
}

async function denied(promise: Promise<unknown>): Promise<string> {
  const err = await promise.then(
    () => null,
    (e) => e,
  )
  expect(err).toBeInstanceOf(VoteDeniedError)
  return (err as VoteDeniedError).reason
}

describe('CastVoteUseCase: XP de participação (MO.6.7)', () => {
  it('concede no primeiro voto, uma vez por assembleia, nunca na troca de voto', async () => {
    const ctx = await setup()
    const a = await ctx.open('a1')
    await ctx.cast.execute({ assemblyId: a.id, userId: 'ana', optionId: a.a })
    await ctx.cast.execute({ assemblyId: a.id, userId: 'ana', optionId: a.b })
    expect(ctx.rewards.rewardFirstVote).toHaveBeenCalledTimes(1)
    expect(ctx.rewards.rewardFirstVote).toHaveBeenCalledWith('ana', a.id)
  })

  it('cada assembleia nova rende o seu próprio crédito, e voto recusado não rende nada', async () => {
    const ctx = await setup()
    ctx.pros.add('ana')
    const a = await ctx.open('a1')
    const b = await ctx.open('b1')
    await ctx.cast.execute({ assemblyId: a.id, userId: 'ana', optionId: a.a })
    await ctx.cast.execute({ assemblyId: b.id, userId: 'ana', optionId: b.b })
    expect(ctx.rewards.rewardFirstVote).toHaveBeenCalledTimes(2)

    ctx.profiles.set('bia', { level: 1, emailVerified: true })
    await ctx.cast.execute({ assemblyId: a.id, userId: 'bia', optionId: a.a }).catch(() => null)
    expect(ctx.rewards.rewardFirstVote).toHaveBeenCalledTimes(2)
  })

  it('a opção escolhida não muda nada: o XP não depende de quem vence', async () => {
    const ctx = await setup()
    const a = await ctx.open('a1')
    await ctx.cast.execute({ assemblyId: a.id, userId: 'ana', optionId: a.a })
    await ctx.cast.execute({ assemblyId: a.id, userId: 'bia', optionId: a.b })
    expect(ctx.rewards.rewardFirstVote.mock.calls.map((c) => c[0])).toEqual(['ana', 'bia'])
  })

  it('falha ao conceder o XP não derruba o voto, que já está gravado', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const ctx = await setup()
    ctx.rewards.rewardFirstVote.mockRejectedValueOnce(new Error('xp fora'))
    const a = await ctx.open('a1')
    await expect(
      ctx.cast.execute({ assemblyId: a.id, userId: 'ana', optionId: a.a }),
    ).resolves.toMatchObject({ changed: false })
    expect(await ctx.repository.findVote(a.id, 'ana')).not.toBeNull()
  })
})

describe('CastVoteUseCase', () => {
  it('não PRO com crédito: vota e gasta o crédito do mês', async () => {
    const ctx = await setup()
    const a = await ctx.open('a1')
    expect(await ctx.cast.execute({ assemblyId: a.id, userId: 'ana', optionId: a.a })).toEqual({
      changed: false,
      creditConsumed: true,
    })
    expect(ctx.repository.credits).toEqual([
      { userId: 'ana', assemblyId: a.id, monthKey: '2026-10' },
    ])
  })

  it('PRO vota sem gastar crédito, mesmo sem e-mail verificado e nível baixo', async () => {
    const ctx = await setup()
    ctx.pros.add('ana')
    ctx.profiles.set('ana', { level: 1, emailVerified: false })
    const a = await ctx.open('a1')
    expect(await ctx.cast.execute({ assemblyId: a.id, userId: 'ana', optionId: a.a })).toEqual({
      changed: false,
      creditConsumed: false,
    })
    expect(ctx.repository.credits).toHaveLength(0)
    expect(ctx.voters.get).not.toHaveBeenCalled()
  })

  it('mudar o voto até o fechamento não consome outro crédito nem exige nada', async () => {
    const ctx = await setup()
    const a = await ctx.open('a1')
    await ctx.cast.execute({ assemblyId: a.id, userId: 'ana', optionId: a.a })
    ctx.profiles.set('ana', { level: 1, emailVerified: false })
    expect(await ctx.cast.execute({ assemblyId: a.id, userId: 'ana', optionId: a.b })).toEqual({
      changed: true,
      creditConsumed: false,
    })
    expect(ctx.repository.credits).toHaveLength(1)
    expect((await ctx.repository.findVote(a.id, 'ana'))?.optionId).toBe(a.b)
  })

  it('quem perdeu o PRO continua podendo trocar o voto que já deu', async () => {
    const ctx = await setup()
    ctx.pros.add('ana')
    const a = await ctx.open('a1')
    await ctx.cast.execute({ assemblyId: a.id, userId: 'ana', optionId: a.a })
    ctx.pros.delete('ana')
    ctx.profiles.set('ana', { level: 1, emailVerified: false })
    expect(
      (await ctx.cast.execute({ assemblyId: a.id, userId: 'ana', optionId: a.b })).changed,
    ).toBe(true)
  })

  it('segundo voto novo no mesmo mês sem PRO: pede PRO ou crédito (e nada é gravado)', async () => {
    const ctx = await setup()
    const a = await ctx.open('a1')
    const b = await ctx.open('b1')
    await ctx.cast.execute({ assemblyId: a.id, userId: 'ana', optionId: a.a })
    expect(await denied(ctx.cast.execute({ assemblyId: b.id, userId: 'ana', optionId: b.a }))).toBe(
      'no_credit',
    )
    expect(await ctx.repository.findVote(b.id, 'ana')).toBeNull()
  })

  it('o crédito volta no mês seguinte (mês de calendário de Brasília)', async () => {
    const ctx = await setup()
    const a = await ctx.open('a1')
    await ctx.cast.execute({ assemblyId: a.id, userId: 'ana', optionId: a.a })
    ctx.advance(25 * DAY)
    const c = await ctx.open('c1')
    expect(
      await ctx.cast.execute({ assemblyId: c.id, userId: 'ana', optionId: c.a }),
    ).toMatchObject({ creditConsumed: true })
    expect(ctx.repository.credits.map((x) => x.monthKey)).toEqual(['2026-10', '2026-11'])
  })

  it.each([
    [
      'sem posição na data de corte (inclui bot, que o motor tira do snapshot)',
      'zeca',
      'not_shareholder',
    ],
  ])('%s', async (_n, userId, reason) => {
    const ctx = await setup()
    const a = await ctx.open('a1')
    expect(await denied(ctx.cast.execute({ assemblyId: a.id, userId, optionId: a.a }))).toBe(reason)
  })

  it('e-mail não verificado e nível baixo bloqueiam só o crédito', async () => {
    const ctx = await setup()
    const a = await ctx.open('a1')
    ctx.profiles.set('ana', { level: 3, emailVerified: false })
    expect(await denied(ctx.cast.execute({ assemblyId: a.id, userId: 'ana', optionId: a.a }))).toBe(
      'email_not_verified',
    )
    ctx.profiles.set('bia', { level: 2, emailVerified: true })
    expect(await denied(ctx.cast.execute({ assemblyId: a.id, userId: 'bia', optionId: a.a }))).toBe(
      'level_too_low',
    )
    expect(ctx.repository.votes).toHaveLength(0)
    expect(ctx.repository.credits).toHaveLength(0)
  })

  it('o nível mínimo vem do parâmetro', async () => {
    const ctx = await setup()
    ctx.params.freeCreditMinLevel = 6
    const a = await ctx.open('a1')
    expect(await denied(ctx.cast.execute({ assemblyId: a.id, userId: 'ana', optionId: a.a }))).toBe(
      'level_too_low',
    )
  })

  it('fora da janela (depois do fechamento) recusa e não gasta o crédito', async () => {
    const ctx = await setup()
    const a = await ctx.open('a1')
    ctx.advance(7 * DAY)
    expect(await denied(ctx.cast.execute({ assemblyId: a.id, userId: 'ana', optionId: a.a }))).toBe(
      'not_open',
    )
    expect(ctx.repository.credits).toHaveLength(0)
  })

  it('corrida com o fechamento: o repositório recusa e o crédito não se perde', async () => {
    const ctx = await setup()
    const a = await ctx.open('a1')
    vi.spyOn(ctx.repository, 'castVote').mockResolvedValueOnce({ status: 'closed' })
    expect(await denied(ctx.cast.execute({ assemblyId: a.id, userId: 'ana', optionId: a.a }))).toBe(
      'not_open',
    )
    expect(ctx.repository.credits).toHaveLength(0)
  })

  it('opção de outra assembleia e assembleia inexistente', async () => {
    const ctx = await setup()
    const a = await ctx.open('a1')
    const b = await ctx.open('b1')
    await expect(
      ctx.cast.execute({ assemblyId: a.id, userId: 'ana', optionId: b.a }),
    ).rejects.toBeInstanceOf(InvalidAssemblyOptionError)
    await expect(
      ctx.cast.execute({ assemblyId: 'nope', userId: 'ana', optionId: a.a }),
    ).rejects.toBeInstanceOf(AssemblyNotFoundError)
  })

  it('assembleia ainda não aberta (agendada) recusa', async () => {
    const ctx = await setup()
    const { assembly, options } = await new CreateAssemblyUseCase(
      new AssemblyKindRegistry().register(SHAREHOLDER_KIND, {
        policies: shareholderPolicies,
        effect: { apply: async () => undefined },
      }),
      ctx.repository,
      () => t0,
    ).execute({
      kind: SHAREHOLDER_KIND,
      subjectRef: 'c',
      dedupeKey: 'sched',
      snapshotAt: t0,
      opensAt: t0,
      closesAt: new Date(t0.getTime() + DAY),
      effectAppliesAt: new Date(t0.getTime() + DAY),
      options: [
        { key: 'a', label: 'a', gain: 'g', loss: 'l', effect: {} },
        { key: 'b', label: 'b', gain: 'g', loss: 'l', effect: {} },
      ],
    })
    expect(
      await denied(
        ctx.cast.execute({ assemblyId: assembly.id, userId: 'ana', optionId: options[0].id }),
      ),
    ).toBe('not_open')
  })
})

describe('GetMyVotingStatusUseCase', () => {
  it('mostra que pode votar, minhas ações e o saldo de crédito', async () => {
    const ctx = await setup()
    const a = await ctx.open('a1')
    expect(await ctx.status.execute({ assemblyId: a.id, userId: 'ana' })).toEqual({
      assemblyId: a.id,
      isPro: false,
      canVote: true,
      reason: null,
      message: null,
      myVote: null,
      myShares: 30,
      credit: { monthKey: '2026-10', limit: 1, used: 0, available: 1, minLevel: 3 },
    })
  })

  it('depois de votar mostra o voto e o crédito usado, e ainda pode trocar', async () => {
    const ctx = await setup()
    const a = await ctx.open('a1')
    await ctx.cast.execute({ assemblyId: a.id, userId: 'ana', optionId: a.a })
    const s = await ctx.status.execute({ assemblyId: a.id, userId: 'ana' })
    expect(s).toMatchObject({
      canVote: true,
      myVote: { optionId: a.a },
      credit: { used: 1, available: 0 },
    })
  })

  it('sem crédito mostra o motivo com o texto do convite', async () => {
    const ctx = await setup()
    const a = await ctx.open('a1')
    const b = await ctx.open('b1')
    await ctx.cast.execute({ assemblyId: a.id, userId: 'ana', optionId: a.a })
    expect(await ctx.status.execute({ assemblyId: b.id, userId: 'ana' })).toMatchObject({
      canVote: false,
      reason: 'no_credit',
      message: 'requer plano PRO ou crédito de voto',
    })
  })

  it('PRO sempre pode (com posição) e sem posição mostra o motivo', async () => {
    const ctx = await setup()
    ctx.pros.add('zeca')
    ctx.pros.add('ana')
    const a = await ctx.open('a1')
    expect(await ctx.status.execute({ assemblyId: a.id, userId: 'zeca' })).toMatchObject({
      canVote: false,
      reason: 'not_shareholder',
      myShares: 0,
    })
    expect(await ctx.status.execute({ assemblyId: a.id, userId: 'ana' })).toMatchObject({
      canVote: true,
      isPro: true,
    })
  })

  it('fechada: não pode votar, mas mostra o voto que a pessoa deu', async () => {
    const ctx = await setup()
    const a = await ctx.open('a1')
    await ctx.cast.execute({ assemblyId: a.id, userId: 'ana', optionId: a.a })
    ctx.advance(8 * DAY)
    expect(await ctx.status.execute({ assemblyId: a.id, userId: 'ana' })).toMatchObject({
      canVote: false,
      reason: 'not_open',
      myVote: { optionId: a.a },
      myShares: null,
    })
  })

  it('assembleia inexistente', async () => {
    const ctx = await setup()
    await expect(ctx.status.execute({ assemblyId: 'nope', userId: 'ana' })).rejects.toBeInstanceOf(
      AssemblyNotFoundError,
    )
  })
})
