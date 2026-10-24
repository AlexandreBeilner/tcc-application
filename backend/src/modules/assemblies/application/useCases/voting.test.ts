import { describe, expect, it, vi } from 'vitest'
import type { HoldingsSnapshot } from '../../domain/assembly'
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
  const rewards = {
    rewardFirstVote: vi.fn<(userId: string, assemblyId: string) => Promise<void>>(
      async () => undefined,
    ),
  }
  const access = new VoteAccessService(kinds, repository, snapshots)
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
    open,
    rewards,
    cast: new CastVoteUseCase(access, repository, now, rewards),
    status: new GetMyVotingStatusUseCase(access, now),
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

  it('cada assembleia nova rende o seu próprio XP, e voto recusado não rende nada', async () => {
    const ctx = await setup()
    const a = await ctx.open('a1')
    const b = await ctx.open('b1')
    await ctx.cast.execute({ assemblyId: a.id, userId: 'ana', optionId: a.a })
    await ctx.cast.execute({ assemblyId: b.id, userId: 'ana', optionId: b.b })
    expect(ctx.rewards.rewardFirstVote).toHaveBeenCalledTimes(2)

    await ctx.cast.execute({ assemblyId: a.id, userId: 'zeca', optionId: a.a }).catch(() => null)
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
  it('acionista vota', async () => {
    const ctx = await setup()
    const a = await ctx.open('a1')
    expect(await ctx.cast.execute({ assemblyId: a.id, userId: 'ana', optionId: a.a })).toEqual({
      changed: false,
    })
    expect((await ctx.repository.findVote(a.id, 'ana'))?.optionId).toBe(a.a)
  })

  it('mudar o voto até o fechamento não exige nada', async () => {
    const ctx = await setup()
    const a = await ctx.open('a1')
    await ctx.cast.execute({ assemblyId: a.id, userId: 'ana', optionId: a.a })
    expect(await ctx.cast.execute({ assemblyId: a.id, userId: 'ana', optionId: a.b })).toEqual({
      changed: true,
    })
    expect((await ctx.repository.findVote(a.id, 'ana'))?.optionId).toBe(a.b)
  })

  it('vota em quantas assembleias quiser no mesmo mês', async () => {
    const ctx = await setup()
    const a = await ctx.open('a1')
    const b = await ctx.open('b1')
    await ctx.cast.execute({ assemblyId: a.id, userId: 'ana', optionId: a.a })
    await ctx.cast.execute({ assemblyId: b.id, userId: 'ana', optionId: b.a })
    expect(await ctx.repository.findVote(b.id, 'ana')).not.toBeNull()
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

  it('fora da janela (depois do fechamento) recusa', async () => {
    const ctx = await setup()
    const a = await ctx.open('a1')
    ctx.advance(7 * DAY)
    expect(await denied(ctx.cast.execute({ assemblyId: a.id, userId: 'ana', optionId: a.a }))).toBe(
      'not_open',
    )
    expect(ctx.repository.votes).toHaveLength(0)
  })

  it('corrida com o fechamento: o repositório recusa', async () => {
    const ctx = await setup()
    const a = await ctx.open('a1')
    vi.spyOn(ctx.repository, 'castVote').mockResolvedValueOnce({ status: 'closed' })
    expect(await denied(ctx.cast.execute({ assemblyId: a.id, userId: 'ana', optionId: a.a }))).toBe(
      'not_open',
    )
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
  it('mostra que pode votar e minhas ações', async () => {
    const ctx = await setup()
    const a = await ctx.open('a1')
    expect(await ctx.status.execute({ assemblyId: a.id, userId: 'ana' })).toEqual({
      assemblyId: a.id,
      canVote: true,
      reason: null,
      message: null,
      myVote: null,
      myShares: 30,
    })
  })

  it('depois de votar mostra o voto, e ainda pode trocar', async () => {
    const ctx = await setup()
    const a = await ctx.open('a1')
    await ctx.cast.execute({ assemblyId: a.id, userId: 'ana', optionId: a.a })
    expect(await ctx.status.execute({ assemblyId: a.id, userId: 'ana' })).toMatchObject({
      canVote: true,
      myVote: { optionId: a.a },
    })
  })

  it('sem posição mostra o motivo', async () => {
    const ctx = await setup()
    const a = await ctx.open('a1')
    expect(await ctx.status.execute({ assemblyId: a.id, userId: 'zeca' })).toMatchObject({
      canVote: false,
      reason: 'not_shareholder',
      myShares: 0,
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
