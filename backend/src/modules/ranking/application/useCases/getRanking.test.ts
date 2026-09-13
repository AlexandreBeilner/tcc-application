import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Snapshot } from '../../domain/networth'
import { createFakeFriendGraphReader } from '../../test/fakes/fakeFriendGraphReader'
import { createFakeLevelReader } from '../../test/fakes/fakeLevelReader'
import { createFakeSandboxAssetReader } from '../../test/fakes/fakeSandboxAssetReader'
import { createFakeUserDirectory } from '../../test/fakes/fakeUserDirectory'
import { GetRankingUseCase } from './getRanking'

function snapshot(overrides: Partial<Snapshot> & { total: number }): Snapshot {
  return {
    cash: overrides.total,
    variableIncomeValue: 0,
    fixedIncomeValue: 0,
    tradesExecuted: 0,
    ...overrides,
  }
}

function build(
  overrides: {
    friendIdsByUserId?: Record<string, string[]>
    progressionByUserId?: Record<string, { level: number; xp: number }>
  } = {},
) {
  return {
    levelReader: createFakeLevelReader(overrides.progressionByUserId),
    friendGraphReader: createFakeFriendGraphReader(overrides.friendIdsByUserId),
  }
}

describe('GetRankingUseCase', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('ordena por rentabilidade desc e reporta a posição do usuário logado', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-26T12:00:00Z')) // quarta, semana 24–30 ago

    const userDirectory = createFakeUserDirectory([
      { id: 'u1', username: 'u1', createdAt: new Date('2026-01-01T00:00:00Z') },
      { id: 'u2', username: 'u2', createdAt: new Date('2026-01-01T00:00:00Z') },
      { id: 'u3', username: 'u3', createdAt: new Date('2026-01-01T00:00:00Z') },
    ])
    const netWorthByUserAndAsOf = new Map<string, number>([
      ['u1|baseline', 10000],
      ['u1|now', 11000], // +10%
      ['u2|baseline', 10000],
      ['u2|now', 12000], // +20%
      ['u3|baseline', 10000],
      ['u3|now', 9000], // -10%
    ])
    const getNetWorth = {
      async execute(input: { userId: string; asOf?: Date }) {
        const key = `${input.userId}|${input.asOf ? 'baseline' : 'now'}`
        return snapshot({ total: netWorthByUserAndAsOf.get(key) ?? 0 })
      },
    }
    const { levelReader, friendGraphReader } = build()
    const useCase = new GetRankingUseCase(
      userDirectory,
      createFakeSandboxAssetReader(),
      getNetWorth,
      levelReader,
      friendGraphReader,
    )

    const result = await useCase.execute({
      window: 'week',
      scope: 'global',
      criterion: 'overall',
      page: 1,
      requestingUserId: 'u1',
    })

    expect(result.entries.map((e) => e.userId)).toEqual(['u2', 'u1', 'u3'])
    expect(result.requestingUserPosition).toBe(2)
  })

  it('resultado consistente independente de quando o usuário entrou — baseline usa MAX(windowStart, accountCreatedAt)', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-26T12:00:00Z')) // quarta, semana 24–30 ago

    const userDirectory = createFakeUserDirectory([
      { id: 'antes', username: 'antes', createdAt: new Date('2026-01-01T00:00:00Z') }, // criada antes da janela
      { id: 'meio', username: 'meio', createdAt: new Date('2026-08-25T00:00:00Z') }, // criada no meio da janela
    ])
    const calls: { userId: string; asOf?: Date }[] = []
    const getNetWorth = {
      async execute(input: { userId: string; asOf?: Date }) {
        calls.push(input)
        return snapshot({ total: 10000 })
      },
    }
    const { levelReader, friendGraphReader } = build()
    const useCase = new GetRankingUseCase(
      userDirectory,
      createFakeSandboxAssetReader(),
      getNetWorth,
      levelReader,
      friendGraphReader,
    )

    await useCase.execute({
      window: 'week',
      scope: 'global',
      criterion: 'overall',
      page: 1,
      requestingUserId: 'antes',
    })

    const baselineCallFor = (userId: string) =>
      calls.find((c) => c.userId === userId && c.asOf !== undefined)

    // "antes": baseline é o início da janela (segunda 00:00 UTC).
    expect(baselineCallFor('antes')?.asOf?.toISOString()).toBe('2026-08-24T00:00:00.000Z')
    // "meio": baseline é a própria criação da conta, não o início da janela.
    expect(baselineCallFor('meio')?.asOf?.toISOString()).toBe('2026-08-25T00:00:00.000Z')
  })

  it('resposta nunca inclui patrimônio absoluto — só username/level/xp/profitabilityPct por usuário (RNF09)', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-26T12:00:00Z'))

    const userDirectory = createFakeUserDirectory([
      { id: 'u1', username: 'alice', createdAt: new Date('2026-01-01T00:00:00Z') },
    ])
    const getNetWorth = {
      async execute() {
        return snapshot({ total: 12345 })
      },
    }
    const { levelReader, friendGraphReader } = build()
    const useCase = new GetRankingUseCase(
      userDirectory,
      createFakeSandboxAssetReader(),
      getNetWorth,
      levelReader,
      friendGraphReader,
    )

    const result = await useCase.execute({
      window: 'month',
      scope: 'global',
      criterion: 'overall',
      page: 1,
      requestingUserId: 'u1',
    })

    expect(Object.keys(result.entries[0]).sort()).toEqual(
      ['userId', 'username', 'level', 'xp', 'profitabilityPct'].sort(),
    )
  })

  it('requestingUserPosition é null se o usuário logado não estiver na lista', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-26T12:00:00Z'))

    const userDirectory = createFakeUserDirectory([
      { id: 'u1', username: 'u1', createdAt: new Date('2026-01-01T00:00:00Z') },
    ])
    const getNetWorth = {
      async execute() {
        return snapshot({ total: 10000 })
      },
    }
    const { levelReader, friendGraphReader } = build()
    const useCase = new GetRankingUseCase(
      userDirectory,
      createFakeSandboxAssetReader(),
      getNetWorth,
      levelReader,
      friendGraphReader,
    )

    const result = await useCase.execute({
      window: 'week',
      scope: 'global',
      criterion: 'overall',
      page: 1,
      requestingUserId: 'fantasma',
    })

    expect(result.requestingUserPosition).toBeNull()
  })

  it('rejeita critério não-level sem window mesmo chamado direto (borda HTTP não é a única defesa)', async () => {
    const userDirectory = createFakeUserDirectory([
      { id: 'u1', username: 'u1', createdAt: new Date('2026-01-01T00:00:00Z') },
    ])
    const getNetWorth = {
      async execute() {
        return snapshot({ total: 10000 })
      },
    }
    const { levelReader, friendGraphReader } = build()
    const useCase = new GetRankingUseCase(
      userDirectory,
      createFakeSandboxAssetReader(),
      getNetWorth,
      levelReader,
      friendGraphReader,
    )

    await expect(
      useCase.execute({ scope: 'global', criterion: 'overall', page: 1, requestingUserId: 'u1' }),
    ).rejects.toThrow(/window/)
  })

  it('usuário cujo patrimônio falha ao calcular é excluído da resposta, sem derrubar o ranking inteiro', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-26T12:00:00Z'))

    const userDirectory = createFakeUserDirectory([
      { id: 'ok1', username: 'ok1', createdAt: new Date('2026-01-01T00:00:00Z') },
      { id: 'orfao', username: 'orfao', createdAt: new Date('2026-01-01T00:00:00Z') },
      { id: 'ok2', username: 'ok2', createdAt: new Date('2026-01-01T00:00:00Z') },
    ])
    const netWorthByUserAndAsOf = new Map<string, number>([
      ['ok1|baseline', 10000],
      ['ok1|now', 11000], // +10%
      ['ok2|baseline', 10000],
      ['ok2|now', 12000], // +20%
    ])
    const getNetWorth = {
      async execute(input: { userId: string; asOf?: Date }) {
        if (input.userId === 'orfao') {
          throw new Error('falha ao ler estado do usuário no motor de simulação (status 404)')
        }
        const key = `${input.userId}|${input.asOf ? 'baseline' : 'now'}`
        return snapshot({ total: netWorthByUserAndAsOf.get(key) ?? 0 })
      },
    }
    const { levelReader, friendGraphReader } = build()
    const useCase = new GetRankingUseCase(
      userDirectory,
      createFakeSandboxAssetReader(),
      getNetWorth,
      levelReader,
      friendGraphReader,
    )

    const result = await useCase.execute({
      window: 'week',
      scope: 'global',
      criterion: 'overall',
      page: 1,
      requestingUserId: 'ok1',
    })

    expect(result.entries.map((e) => e.userId)).toEqual(['ok2', 'ok1'])
    expect(result.requestingUserPosition).toBe(2)
  })

  it('conta de bot nunca aparece no ranking, em nenhum escopo (tarefa A.1, backlog-motor-mercado-realista) — exclusão por construção: bot só existe em `accounts` no motor, nunca em `users` aqui, então `userDirectory.listAll()` já não o traz, mesmo que outros leitores "soubessem" responder por ele', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-26T12:00:00Z'))

    const botId = 'bot-market-maker-1'
    const userDirectory = createFakeUserDirectory([
      { id: 'u1', username: 'u1', createdAt: new Date('2026-01-01T00:00:00Z') },
      { id: 'u2', username: 'u2', createdAt: new Date('2026-01-01T00:00:00Z') },
    ])
    const netWorthByUserAndAsOf = new Map<string, number>([
      ['u1|baseline', 10000],
      ['u1|now', 11000],
      ['u2|baseline', 10000],
      ['u2|now', 12000],
      // Se o ranking algum dia passasse a iterar sobre uma fonte diferente
      // de `userDirectory.listAll()` (ex: contas do motor direto), este
      // valor faria o bot aparecer com folga em 1º lugar — o teste falharia
      // de forma óbvia em vez de passar silenciosamente por falta de dado.
      ['bot-market-maker-1|baseline', 10000],
      ['bot-market-maker-1|now', 999999],
    ])
    const getNetWorth = {
      async execute(input: { userId: string; asOf?: Date }) {
        const key = `${input.userId}|${input.asOf ? 'baseline' : 'now'}`
        return snapshot({ total: netWorthByUserAndAsOf.get(key) ?? 0 })
      },
    }
    // Simula um grafo de amizade "corrompido" que referencia o bot — mesmo
    // assim ele não pode aparecer no escopo amigos, porque `scopedUsers`
    // filtra contra `allUsers` (que já não o contém).
    const { levelReader, friendGraphReader } = build({
      friendIdsByUserId: { u1: [botId, 'u2'] },
      progressionByUserId: { [botId]: { level: 99, xp: 999999 } },
    })
    const useCase = new GetRankingUseCase(
      userDirectory,
      createFakeSandboxAssetReader(),
      getNetWorth,
      levelReader,
      friendGraphReader,
    )

    const global = await useCase.execute({
      window: 'week',
      scope: 'global',
      criterion: 'overall',
      page: 1,
      requestingUserId: 'u1',
    })
    const friends = await useCase.execute({
      window: 'week',
      scope: 'friends',
      criterion: 'overall',
      page: 1,
      requestingUserId: 'u1',
    })
    const byLevel = await useCase.execute({
      scope: 'global',
      criterion: 'level',
      page: 1,
      requestingUserId: 'u1',
    })

    expect(global.entries.map((e) => e.userId)).not.toContain(botId)
    expect(friends.entries.map((e) => e.userId)).not.toContain(botId)
    expect(byLevel.entries.map((e) => e.userId)).not.toContain(botId)
  })

  describe('escopo amigos', () => {
    it('inclui só {o próprio usuário} ∪ amigos aceitos, exclui amigo pendente', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-08-26T12:00:00Z'))

      const userDirectory = createFakeUserDirectory([
        { id: 'u1', username: 'u1', createdAt: new Date('2026-01-01T00:00:00Z') },
        {
          id: 'amigo-aceito',
          username: 'amigo-aceito',
          createdAt: new Date('2026-01-01T00:00:00Z'),
        },
        {
          id: 'amigo-pendente',
          username: 'amigo-pendente',
          createdAt: new Date('2026-01-01T00:00:00Z'),
        },
        { id: 'estranho', username: 'estranho', createdAt: new Date('2026-01-01T00:00:00Z') },
      ])
      const getNetWorth = {
        async execute() {
          return snapshot({ total: 10000 })
        },
      }
      const { levelReader, friendGraphReader } = build({
        friendIdsByUserId: { u1: ['amigo-aceito'] },
      })
      const useCase = new GetRankingUseCase(
        userDirectory,
        createFakeSandboxAssetReader(),
        getNetWorth,
        levelReader,
        friendGraphReader,
      )

      const result = await useCase.execute({
        window: 'week',
        scope: 'friends',
        criterion: 'overall',
        page: 1,
        requestingUserId: 'u1',
      })

      expect(result.entries.map((e) => e.userId).sort()).toEqual(['amigo-aceito', 'u1'])
    })

    it('lista vazia quando o usuário não tem nenhum amigo aceito (não é erro)', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-08-26T12:00:00Z'))

      const userDirectory = createFakeUserDirectory([
        { id: 'u1', username: 'u1', createdAt: new Date('2026-01-01T00:00:00Z') },
        { id: 'outro', username: 'outro', createdAt: new Date('2026-01-01T00:00:00Z') },
      ])
      const getNetWorth = {
        async execute() {
          return snapshot({ total: 10000 })
        },
      }
      // requestingUserId 'fantasma' não está em `userDirectory` — simula um
      // usuário sem nenhum amigo e que também não aparece nos próprios
      // resultados (mesma asserção que "lista vazia, não erro").
      const { levelReader, friendGraphReader } = build()
      const useCase = new GetRankingUseCase(
        userDirectory,
        createFakeSandboxAssetReader(),
        getNetWorth,
        levelReader,
        friendGraphReader,
      )

      const result = await useCase.execute({
        window: 'week',
        scope: 'friends',
        criterion: 'overall',
        page: 1,
        requestingUserId: 'fantasma',
      })

      expect(result.entries).toEqual([])
      expect(result.requestingUserPosition).toBeNull()
    })

    it('mesma janela fixa nos dois escopos — não recalcula critério de tempo diferente', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-08-26T12:00:00Z'))

      const userDirectory = createFakeUserDirectory([
        { id: 'u1', username: 'u1', createdAt: new Date('2026-01-01T00:00:00Z') },
      ])
      const calls: { asOf?: Date }[] = []
      const getNetWorth = {
        async execute(input: { asOf?: Date }) {
          calls.push(input)
          return snapshot({ total: 10000 })
        },
      }
      const { levelReader, friendGraphReader } = build()
      const useCase = new GetRankingUseCase(
        userDirectory,
        createFakeSandboxAssetReader(),
        getNetWorth,
        levelReader,
        friendGraphReader,
      )

      await useCase.execute({
        window: 'week',
        scope: 'global',
        criterion: 'overall',
        page: 1,
        requestingUserId: 'u1',
      })
      const globalBaselineAsOf = calls.find((c) => c.asOf !== undefined)?.asOf?.toISOString()
      calls.length = 0

      await useCase.execute({
        window: 'week',
        scope: 'friends',
        criterion: 'overall',
        page: 1,
        requestingUserId: 'u1',
      })
      const friendsBaselineAsOf = calls.find((c) => c.asOf !== undefined)?.asOf?.toISOString()

      expect(friendsBaselineAsOf).toBe(globalBaselineAsOf)
    })
  })

  describe('paginação (6.8.2)', () => {
    function buildManyUsers(count: number) {
      const users = Array.from({ length: count }, (_, i) => ({
        id: `u${i + 1}`,
        username: `user${i + 1}`,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      }))
      const userDirectory = createFakeUserDirectory(users)
      // Rentabilidade decrescente: u1 é o 1º colocado, u{count} é o último.
      const getNetWorth = {
        async execute(input: { userId: string; asOf?: Date }) {
          const rank = Number(input.userId.slice(1))
          const gainPct = count - rank
          return snapshot({ total: input.asOf ? 10000 : 10000 * (1 + gainPct / 100) })
        },
      }
      return { userDirectory, getNetWorth }
    }

    it('devolve 25 entradas por página, com page/pageSize/totalEntries/totalPages', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-08-26T12:00:00Z'))

      const { userDirectory, getNetWorth } = buildManyUsers(60)
      const { levelReader, friendGraphReader } = build()
      const useCase = new GetRankingUseCase(
        userDirectory,
        createFakeSandboxAssetReader(),
        getNetWorth,
        levelReader,
        friendGraphReader,
      )

      const page1 = await useCase.execute({
        window: 'week',
        scope: 'global',
        criterion: 'overall',
        page: 1,
        requestingUserId: 'u1',
      })
      expect(page1.entries).toHaveLength(25)
      expect(page1.entries[0].userId).toBe('u1')
      expect(page1.pageSize).toBe(25)
      expect(page1.totalEntries).toBe(60)
      expect(page1.totalPages).toBe(3)
      expect(page1.page).toBe(1)

      const page3 = await useCase.execute({
        window: 'week',
        scope: 'global',
        criterion: 'overall',
        page: 3,
        requestingUserId: 'u1',
      })
      expect(page3.entries).toHaveLength(10)
      expect(page3.entries[0].userId).toBe('u51')
    })

    it('página fora do intervalo é clampada pro extremo mais próximo, nunca 400/vazia enganosa', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-08-26T12:00:00Z'))

      const { userDirectory, getNetWorth } = buildManyUsers(10)
      const { levelReader, friendGraphReader } = build()
      const useCase = new GetRankingUseCase(
        userDirectory,
        createFakeSandboxAssetReader(),
        getNetWorth,
        levelReader,
        friendGraphReader,
      )

      const beyond = await useCase.execute({
        window: 'week',
        scope: 'global',
        criterion: 'overall',
        page: 99,
        requestingUserId: 'u1',
      })
      expect(beyond.page).toBe(1)
      expect(beyond.entries).toHaveLength(10)
    })

    it('requestingUserPosition independe da página pedida', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-08-26T12:00:00Z'))

      const { userDirectory, getNetWorth } = buildManyUsers(30)
      const { levelReader, friendGraphReader } = build()
      const useCase = new GetRankingUseCase(
        userDirectory,
        createFakeSandboxAssetReader(),
        getNetWorth,
        levelReader,
        friendGraphReader,
      )

      // u30 é o último colocado (30º) — pedindo a página 1, ele não
      // aparece em `entries`, mas a posição dele continua reportada.
      const result = await useCase.execute({
        window: 'week',
        scope: 'global',
        criterion: 'overall',
        page: 1,
        requestingUserId: 'u30',
      })
      expect(result.entries.some((e) => e.userId === 'u30')).toBe(false)
      expect(result.requestingUserPosition).toBe(30)
    })
  })

  describe('critérios de classificação (6.8.3)', () => {
    it('critério fixedIncome ordena só pela perna de renda fixa', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-08-26T12:00:00Z'))

      const userDirectory = createFakeUserDirectory([
        { id: 'u1', username: 'u1', createdAt: new Date('2026-01-01T00:00:00Z') },
        { id: 'u2', username: 'u2', createdAt: new Date('2026-01-01T00:00:00Z') },
      ])
      // u1: ganha em renda variável mas perde em renda fixa; u2 o oposto —
      // um critério que ainda usasse `total` inverteria a ordem esperada.
      const snapshotsByUserAndAsOf: Record<string, Snapshot> = {
        'u1|baseline': snapshot({ total: 10000, fixedIncomeValue: 5000, variableIncomeValue: 0 }),
        'u1|now': snapshot({ total: 10500, fixedIncomeValue: 4500, variableIncomeValue: 1000 }),
        'u2|baseline': snapshot({ total: 10000, fixedIncomeValue: 5000, variableIncomeValue: 0 }),
        'u2|now': snapshot({ total: 10200, fixedIncomeValue: 5200, variableIncomeValue: 0 }),
      }
      const getNetWorth = {
        async execute(input: { userId: string; asOf?: Date }) {
          return snapshotsByUserAndAsOf[`${input.userId}|${input.asOf ? 'baseline' : 'now'}`]
        },
      }
      const { levelReader, friendGraphReader } = build()
      const useCase = new GetRankingUseCase(
        userDirectory,
        createFakeSandboxAssetReader(),
        getNetWorth,
        levelReader,
        friendGraphReader,
      )

      const result = await useCase.execute({
        window: 'week',
        scope: 'global',
        criterion: 'fixedIncome',
        page: 1,
        requestingUserId: 'u1',
      })

      expect(result.entries.map((e) => e.userId)).toEqual(['u2', 'u1'])
      expect(result.entries.find((e) => e.userId === 'u2')?.profitabilityPct).toBeCloseTo(4)
      expect(result.entries.find((e) => e.userId === 'u1')?.profitabilityPct).toBeCloseTo(-10)
    })

    it('usuário sem nenhuma posição da classe no início da janela é excluído (nunca investiu ≠ empatou em 0%)', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-08-26T12:00:00Z'))

      const userDirectory = createFakeUserDirectory([
        { id: 'investiu', username: 'investiu', createdAt: new Date('2026-01-01T00:00:00Z') },
        {
          id: 'nunca-investiu',
          username: 'nunca-investiu',
          createdAt: new Date('2026-01-01T00:00:00Z'),
        },
      ])
      const snapshotsByUserAndAsOf: Record<string, Snapshot> = {
        'investiu|baseline': snapshot({ total: 10000, fixedIncomeValue: 1000 }),
        'investiu|now': snapshot({ total: 10000, fixedIncomeValue: 1000 }), // 0% real
        'nunca-investiu|baseline': snapshot({ total: 10000, fixedIncomeValue: 0 }),
        'nunca-investiu|now': snapshot({ total: 10000, fixedIncomeValue: 0 }),
      }
      const getNetWorth = {
        async execute(input: { userId: string; asOf?: Date }) {
          return snapshotsByUserAndAsOf[`${input.userId}|${input.asOf ? 'baseline' : 'now'}`]
        },
      }
      const { levelReader, friendGraphReader } = build()
      const useCase = new GetRankingUseCase(
        userDirectory,
        createFakeSandboxAssetReader(),
        getNetWorth,
        levelReader,
        friendGraphReader,
      )

      const result = await useCase.execute({
        window: 'week',
        scope: 'global',
        criterion: 'fixedIncome',
        page: 1,
        requestingUserId: 'investiu',
      })

      expect(result.entries.map((e) => e.userId)).toEqual(['investiu'])
      expect(result.totalEntries).toBe(1)
    })

    it('critério level ordena por xp, ignora janela e nunca chama o motor', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-08-26T12:00:00Z'))

      const userDirectory = createFakeUserDirectory([
        { id: 'u1', username: 'u1', createdAt: new Date('2026-01-01T00:00:00Z') },
        { id: 'u2', username: 'u2', createdAt: new Date('2026-01-01T00:00:00Z') },
        { id: 'u3', username: 'u3', createdAt: new Date('2026-01-01T00:00:00Z') },
      ])
      let netWorthCalls = 0
      const getNetWorth = {
        async execute() {
          netWorthCalls++
          return snapshot({ total: 10000 })
        },
      }
      const { levelReader, friendGraphReader } = build({
        progressionByUserId: {
          u1: { level: 3, xp: 350 },
          u2: { level: 5, xp: 900 },
          u3: { level: 3, xp: 250 },
        },
      })
      const useCase = new GetRankingUseCase(
        userDirectory,
        createFakeSandboxAssetReader(),
        getNetWorth,
        levelReader,
        friendGraphReader,
      )

      const result = await useCase.execute({
        scope: 'global',
        criterion: 'level',
        page: 1,
        requestingUserId: 'u1',
      })

      expect(result.entries.map((e) => e.userId)).toEqual(['u2', 'u1', 'u3'])
      expect(result.entries.every((e) => e.profitabilityPct === null)).toBe(true)
      expect(result.window).toBeNull()
      expect(netWorthCalls).toBe(0)
    })

    it('critério level: usuário com progressão inconsistente é excluído da resposta, sem derrubar o ranking inteiro', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-08-26T12:00:00Z'))

      const userDirectory = createFakeUserDirectory([
        { id: 'ok1', username: 'ok1', createdAt: new Date('2026-01-01T00:00:00Z') },
        { id: 'orfao', username: 'orfao', createdAt: new Date('2026-01-01T00:00:00Z') },
      ])
      const getNetWorth = {
        async execute() {
          return snapshot({ total: 10000 })
        },
      }
      const levelReader = {
        async getProgression(userId: string) {
          if (userId === 'orfao') {
            throw new Error('user_progression ausente pra esse usuário')
          }
          return { level: 3, xp: 350 }
        },
      }
      const { friendGraphReader } = build()
      const useCase = new GetRankingUseCase(
        userDirectory,
        createFakeSandboxAssetReader(),
        getNetWorth,
        levelReader,
        friendGraphReader,
      )

      const result = await useCase.execute({
        scope: 'global',
        criterion: 'level',
        page: 1,
        requestingUserId: 'ok1',
      })

      expect(result.entries.map((e) => e.userId)).toEqual(['ok1'])
    })
  })
})
