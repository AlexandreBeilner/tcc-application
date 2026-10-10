import { describe, expect, it } from 'vitest'
import {
  AlreadyInLeagueError,
  InvalidLeagueNameError,
  InvitationNotFoundError,
  LeagueFullError,
  LeagueLimitReachedError,
  LeagueNotFoundError,
  NotFriendsError,
  NotLeagueOwnerError,
  OwnerCannotLeaveError,
} from '../../domain/errors'
import { createFakeLeagueRepository } from '../../test/fakes/fakeLeagueRepository'
import {
  createFakeFriendships,
  createFakeMembership,
  createFakeProAccess,
  createFakeScores,
  createFakeUsers,
} from '../../test/fakes/fakes'
import { CloseLeagueUseCase } from './closeLeague'
import { CreateLeagueUseCase } from './createLeague'
import { GetLeagueUseCase } from './getLeague'
import { InviteToLeagueUseCase } from './inviteToLeague'
import { LeaveLeagueUseCase } from './leaveLeague'
import { ListMyLeaguesUseCase } from './listMyLeagues'
import { RemoveLeagueMemberUseCase } from './removeLeagueMember'
import { RenameLeagueUseCase } from './renameLeague'
import { RespondToLeagueInvitationUseCase } from './respondToLeagueInvitation'

const NOW = new Date('2026-10-10T12:00:00Z')

function build(proIds = ['dono']) {
  const repo = createFakeLeagueRepository()
  const access = createFakeProAccess(proIds)
  const friendships = createFakeFriendships([
    ['dono', 'amigo1'],
    ['dono', 'amigo2'],
  ])
  const scores = createFakeScores({ dono: 5, amigo1: 12, amigo2: -3 })
  const users = createFakeUsers(['dono', 'amigo1', 'amigo2', 'estranho'])
  const membership = createFakeMembership(access)
  const now = () => NOW
  return {
    repo,
    access,
    scores,
    create: new CreateLeagueUseCase(access, repo, now),
    invite: new InviteToLeagueUseCase(access, repo, friendships, now),
    respond: new RespondToLeagueInvitationUseCase(repo, now),
    leave: new LeaveLeagueUseCase(repo),
    remove: new RemoveLeagueMemberUseCase(repo),
    rename: new RenameLeagueUseCase(access, repo),
    close: new CloseLeagueUseCase(repo, now),
    list: new ListMyLeaguesUseCase(repo, membership, users),
    get: new GetLeagueUseCase(repo, scores, membership, users),
  }
}

async function leagueWithTwoFriends(ctx: ReturnType<typeof build>) {
  const league = await ctx.create.execute({ userId: 'dono', name: 'Turma TCC', window: 'week' })
  for (const friend of ['amigo1', 'amigo2']) {
    await ctx.invite.execute({ userId: 'dono', leagueId: league.id, targetUserId: friend })
    await ctx.respond.execute({ userId: friend, leagueId: league.id, accept: true })
  }
  return league
}

describe('criar liga', () => {
  it('PRO cria e vira membro ativo; nome é normalizado', async () => {
    const ctx = build()
    const league = await ctx.create.execute({
      userId: 'dono',
      name: '  Turma   TCC ',
      window: 'month',
    })
    expect(league.name).toBe('Turma TCC')
    expect((await ctx.repo.findMember(league.id, 'dono'))?.status).toBe('active')
  })

  it('sem PRO responde requer plano PRO e não grava', async () => {
    const ctx = build([])
    await expect(
      ctx.create.execute({ userId: 'dono', name: 'Turma', window: 'week' }),
    ).rejects.toMatchObject({ code: 'PRO_REQUIRED' })
    expect(ctx.repo.leagues.size).toBe(0)
  })

  it('nome inválido é recusado', async () => {
    await expect(
      build().create.execute({ userId: 'dono', name: 'ab', window: 'week' }),
    ).rejects.toBeInstanceOf(InvalidLeagueNameError)
  })

  it('a quarta liga aberta é recusada; encerrar uma libera a vaga', async () => {
    const ctx = build()
    const created = []
    for (let i = 0; i < 3; i++) {
      created.push(await ctx.create.execute({ userId: 'dono', name: `Liga ${i}`, window: 'week' }))
    }
    await expect(
      ctx.create.execute({ userId: 'dono', name: 'Liga 4', window: 'week' }),
    ).rejects.toBeInstanceOf(LeagueLimitReachedError)

    await ctx.close.execute({ userId: 'dono', leagueId: created[0].id })
    await expect(
      ctx.create.execute({ userId: 'dono', name: 'Liga 4', window: 'week' }),
    ).resolves.toBeTruthy()
  })
})

describe('convites', () => {
  it('convite só entre amigos aceitos', async () => {
    const ctx = build()
    const league = await ctx.create.execute({ userId: 'dono', name: 'Turma', window: 'week' })
    await expect(
      ctx.invite.execute({ userId: 'dono', leagueId: league.id, targetUserId: 'estranho' }),
    ).rejects.toBeInstanceOf(NotFriendsError)
  })

  it('só o dono, e com PRO ativo, convida', async () => {
    const ctx = build(['dono', 'amigo1'])
    const league = await ctx.create.execute({ userId: 'dono', name: 'Turma', window: 'week' })
    await expect(
      ctx.invite.execute({ userId: 'amigo1', leagueId: league.id, targetUserId: 'dono' }),
    ).rejects.toBeInstanceOf(LeagueNotFoundError)

    ctx.access.ids.delete('dono')
    await expect(
      ctx.invite.execute({ userId: 'dono', leagueId: league.id, targetUserId: 'amigo1' }),
    ).rejects.toMatchObject({ code: 'PRO_REQUIRED' })
  })

  it('convidar de novo ou quem já está na liga é recusado', async () => {
    const ctx = build()
    const league = await ctx.create.execute({ userId: 'dono', name: 'Turma', window: 'week' })
    await ctx.invite.execute({ userId: 'dono', leagueId: league.id, targetUserId: 'amigo1' })
    await expect(
      ctx.invite.execute({ userId: 'dono', leagueId: league.id, targetUserId: 'amigo1' }),
    ).rejects.toBeInstanceOf(AlreadyInLeagueError)
  })

  it('liga cheia (20 entre membros e convites) recusa mais um', async () => {
    const ctx = build()
    const league = await ctx.create.execute({ userId: 'dono', name: 'Turma', window: 'week' })
    for (let i = 0; i < 19; i++) {
      await ctx.repo.addMemberIfRoom(
        { leagueId: league.id, userId: `x${i}`, status: 'invited', invitedBy: 'dono', now: NOW },
        20,
      )
    }
    await expect(
      ctx.invite.execute({ userId: 'dono', leagueId: league.id, targetUserId: 'amigo1' }),
    ).rejects.toBeInstanceOf(LeagueFullError)
  })

  it('membro gratuito aceita sem PRO e passa a participar', async () => {
    const ctx = build()
    const league = await ctx.create.execute({ userId: 'dono', name: 'Turma', window: 'week' })
    await ctx.invite.execute({ userId: 'dono', leagueId: league.id, targetUserId: 'amigo1' })
    await ctx.respond.execute({ userId: 'amigo1', leagueId: league.id, accept: true })
    const member = await ctx.repo.findMember(league.id, 'amigo1')
    expect(member?.status).toBe('active')
    expect(member?.joinedAt).toEqual(NOW)
  })

  it('recusar remove o convite; responder sem convite pendente falha', async () => {
    const ctx = build()
    const league = await ctx.create.execute({ userId: 'dono', name: 'Turma', window: 'week' })
    await ctx.invite.execute({ userId: 'dono', leagueId: league.id, targetUserId: 'amigo1' })
    await ctx.respond.execute({ userId: 'amigo1', leagueId: league.id, accept: false })
    expect(await ctx.repo.findMember(league.id, 'amigo1')).toBeNull()

    await expect(
      ctx.respond.execute({ userId: 'dono', leagueId: league.id, accept: true }),
    ).rejects.toBeInstanceOf(InvitationNotFoundError)
  })
})

describe('sair, remover, renomear e encerrar', () => {
  it('membro sai; dono não sai', async () => {
    const ctx = build()
    const league = await leagueWithTwoFriends(ctx)
    await ctx.leave.execute({ userId: 'amigo1', leagueId: league.id })
    expect(await ctx.repo.findMember(league.id, 'amigo1')).toBeNull()
    await expect(ctx.leave.execute({ userId: 'dono', leagueId: league.id })).rejects.toBeInstanceOf(
      OwnerCannotLeaveError,
    )
  })

  it('dono remove membro mesmo depois de cancelar o PRO; outro membro não pode', async () => {
    const ctx = build()
    const league = await leagueWithTwoFriends(ctx)
    await expect(
      ctx.remove.execute({ userId: 'amigo1', leagueId: league.id, targetUserId: 'amigo2' }),
    ).rejects.toBeInstanceOf(NotLeagueOwnerError)

    ctx.access.ids.delete('dono')
    await ctx.remove.execute({ userId: 'dono', leagueId: league.id, targetUserId: 'amigo2' })
    expect(await ctx.repo.findMember(league.id, 'amigo2')).toBeNull()
  })

  it('renomear exige PRO do dono', async () => {
    const ctx = build()
    const league = await ctx.create.execute({ userId: 'dono', name: 'Turma', window: 'week' })
    await ctx.rename.execute({ userId: 'dono', leagueId: league.id, name: 'Nova Turma' })
    expect((await ctx.repo.findById(league.id))?.name).toBe('Nova Turma')

    ctx.access.ids.delete('dono')
    await expect(
      ctx.rename.execute({ userId: 'dono', leagueId: league.id, name: 'Outra' }),
    ).rejects.toMatchObject({ code: 'PRO_REQUIRED' })
  })

  it('liga encerrada some para todos e vira não encontrada, sem apagar dados', async () => {
    const ctx = build()
    const league = await leagueWithTwoFriends(ctx)
    await ctx.close.execute({ userId: 'dono', leagueId: league.id })
    await expect(ctx.get.execute({ userId: 'amigo1', leagueId: league.id })).rejects.toBeInstanceOf(
      LeagueNotFoundError,
    )
    expect(await ctx.list.execute('amigo1')).toEqual([])
    expect(ctx.repo.members.filter((m) => m.leagueId === league.id)).toHaveLength(3)
  })
})

describe('listar e detalhar', () => {
  it('lista com papel, status, contagem e arquivamento derivado do plano do dono', async () => {
    const ctx = build()
    const league = await leagueWithTwoFriends(ctx)
    await ctx.invite
      .execute({ userId: 'dono', leagueId: league.id, targetUserId: 'amigo1' })
      .catch(() => {})

    const [mine] = await ctx.list.execute('amigo1')
    expect(mine).toMatchObject({
      id: league.id,
      isOwner: false,
      status: 'active',
      memberCount: 3,
      archived: false,
      ownerUsername: 'dono',
    })

    ctx.access.ids.delete('dono')
    expect((await ctx.list.execute('amigo1'))[0].archived).toBe(true)
    ctx.access.ids.add('dono')
    expect((await ctx.list.execute('amigo1'))[0].archived).toBe(false)
  })

  it('classificação ordena por rentabilidade percentual, só com percentual', async () => {
    const ctx = build()
    const league = await leagueWithTwoFriends(ctx)
    const detail = await ctx.get.execute({ userId: 'amigo2', leagueId: league.id })

    expect(detail.standings.map((s) => [s.position, s.userId, s.profitabilityPct])).toEqual([
      [1, 'amigo1', 12],
      [2, 'dono', 5],
      [3, 'amigo2', -3],
    ])
    expect(detail.standings.find((s) => s.isYou)?.userId).toBe('amigo2')
    expect(Object.keys(detail.standings[0]).sort()).toEqual(
      [
        'avatarUrl',
        'cosmetics',
        'isYou',
        'level',
        'name',
        'position',
        'profitabilityPct',
        'userId',
        'username',
      ].sort(),
    )
    expect(ctx.scores.calls[0].window).toBe('week')
  })

  it('quem não pôde ser pontuado aparece no fim sem número', async () => {
    const ctx = build()
    const league = await leagueWithTwoFriends(ctx)
    const scores = createFakeScores({ dono: 5, amigo1: 12 })
    const get = new GetLeagueUseCase(
      ctx.repo,
      scores,
      createFakeMembership(ctx.access),
      createFakeUsers(['dono', 'amigo1', 'amigo2']),
    )
    const detail = await get.execute({ userId: 'dono', leagueId: league.id })
    expect(detail.standings.at(-1)).toMatchObject({ userId: 'amigo2', profitabilityPct: null })
  })

  it('convidado vê a liga mas ainda sem classificação; só o dono vê convites pendentes', async () => {
    const ctx = build()
    const league = await ctx.create.execute({ userId: 'dono', name: 'Turma', window: 'week' })
    await ctx.invite.execute({ userId: 'dono', leagueId: league.id, targetUserId: 'amigo1' })

    const invitee = await ctx.get.execute({ userId: 'amigo1', leagueId: league.id })
    expect(invitee.league.status).toBe('invited')
    expect(invitee.standings).toEqual([])
    expect(invitee.pendingInvites).toEqual([])
    expect(ctx.scores.calls).toHaveLength(0)

    const owner = await ctx.get.execute({ userId: 'dono', leagueId: league.id })
    expect(owner.pendingInvites).toEqual([{ userId: 'amigo1', username: 'amigo1' }])
  })

  it('quem não participa recebe não encontrada (nunca vaza que a liga existe)', async () => {
    const ctx = build()
    const league = await ctx.create.execute({ userId: 'dono', name: 'Turma', window: 'week' })
    await expect(
      ctx.get.execute({ userId: 'estranho', leagueId: league.id }),
    ).rejects.toBeInstanceOf(LeagueNotFoundError)
  })

  it('liga arquivada continua visível com a classificação', async () => {
    const ctx = build()
    const league = await leagueWithTwoFriends(ctx)
    ctx.access.ids.delete('dono')
    const detail = await ctx.get.execute({ userId: 'amigo1', leagueId: league.id })
    expect(detail.league.archived).toBe(true)
    expect(detail.standings).toHaveLength(3)
  })
})
