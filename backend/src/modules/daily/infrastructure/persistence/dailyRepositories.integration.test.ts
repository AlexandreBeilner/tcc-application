import path from 'node:path'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Database } from '../../../../db/client'
import * as schema from '../../../../db/schema'
import { MaterializeUpcomingPuzzlesUseCase } from '../../application/useCases/materializeUpcomingPuzzles'
import type { DailyResult } from '../../domain/content'
import { createDrizzleAcceptedWordRepository } from './drizzleAcceptedWordRepository'
import { createDrizzleDailyEventRepository } from './drizzleDailyEventRepository'
import { createDrizzleDailyQuestionRepository } from './drizzleDailyQuestionRepository'
import { createDrizzleDailyPuzzleRepository } from './drizzleDailyPuzzleRepository'
import { DailyProgressRecorder } from '../../application/dailyProgressRecorder'
import type { LoadedGame } from '../../application/dailyGameLoader'
import { CardAlreadyAnsweredError } from '../../domain/errors'
import { recordTimeline } from '../../domain/resultState'
import {
  createFakeStreakTracker,
  createFakeXpAwarder,
} from '../../test/fakes/fakeDailyRepositories'
import { createDrizzleDailyMetricsRepository } from './drizzleDailyMetricsRepository'
import { createDrizzleDailyResultRepository } from './drizzleDailyResultRepository'
import { createDrizzleDailySettingsRepository } from './drizzleDailySettingsRepository'
import { createDrizzleDailyWordRepository } from './drizzleDailyWordRepository'

// Teste de integração (DI.1.2). Só roda com TEST_DATABASE_URL apontando para um banco DESCARTÁVEL
// (apaga as tabelas `daily_*`). Cobre o que fake não prova: as UNIQUE e os CHECK reais, o upsert
// de resultado e a ordem/filtro da agenda.
const databaseUrl = process.env.TEST_DATABASE_URL
const NOW = new Date('2026-11-03T12:00:00Z')

const wordInput = (
  answer: string,
  extra: Partial<Parameters<ReturnType<typeof createDrizzleDailyWordRepository>['create']>[0]> = {},
) => ({
  stableKey: `palavra-${answer.toLowerCase()}`,
  answer,
  display: answer,
  definition: 'Definição curta.',
  learnMore: null,
  category: 'juros',
  scope: 'brasil' as const,
  active: true,
  ...extra,
})

const questionInput = (key: string, extra: Record<string, unknown> = {}) => ({
  stableKey: key,
  question: 'Qual índice mede a inflação oficial do Brasil?',
  options: ['IPCA', 'IGP-M', 'CDI', 'Selic'],
  correctIndex: 0,
  explanation: 'O IPCA, do IBGE, é a referência da meta de inflação.',
  sourceRef: 'IBGE',
  learnMore: { kind: 'glossary' as const, ref: 'ipca' },
  category: 'inflacao',
  scope: 'brasil' as const,
  reviewedAt: null,
  active: true,
  ...extra,
})

const eventInput = (key: string, year: number, extra: Record<string, unknown> = {}) => ({
  stableKey: key,
  year,
  label: key,
  explanation: 'Por que importou.',
  sourceRef: 'Banco Central do Brasil',
  learnMore: null,
  category: 'moeda',
  scope: 'brasil' as const,
  reviewedAt: null,
  active: true,
  ...extra,
})

describe.skipIf(!databaseUrl)('repositórios do Diário (banco real)', () => {
  let pool: Pool
  let db: Database
  let userId: string

  const words = () => createDrizzleDailyWordRepository(db)
  const questions = () => createDrizzleDailyQuestionRepository(db)
  const events = () => createDrizzleDailyEventRepository(db)
  const puzzles = () => createDrizzleDailyPuzzleRepository(db)
  const results = () => createDrizzleDailyResultRepository(db)

  async function clean() {
    await db.delete(schema.dailyResults)
    await db.delete(schema.dailyMetrics)
    await db.delete(schema.dailyPuzzles)
    await db.delete(schema.dailyQuestions)
    await db.delete(schema.dailyEvents)
    await db.delete(schema.dailyWords)
    await db.delete(schema.dailyAcceptedWords)
    await db.update(schema.dailySettings).set({ startDate: null, updatedBy: null })
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl, max: 5 })
    const drizzleDb = drizzle(pool, { schema })
    await migrate(drizzleDb, {
      migrationsFolder: path.join(__dirname, '../../../../db/migrations'),
    })
    db = drizzleDb as unknown as Database
  })

  beforeEach(async () => {
    await clean()
    await db.delete(schema.users).where(eq(schema.users.username, 'diario_teste'))
    const [user] = await db
      .insert(schema.users)
      .values({
        name: 'Ana',
        username: 'diario_teste',
        email: 'diario_teste@exemplo.com',
        passwordHash: 'x',
      })
      .returning({ id: schema.users.id })
    userId = user.id
  })

  afterAll(async () => {
    await clean()
    await db.delete(schema.users).where(eq(schema.users.username, 'diario_teste'))
    await pool.end()
  })

  async function seedPuzzle(number: number, gameDate: string, publishedAt: Date | null = null) {
    const word = await words().create(wordInput(`PALAVRA${String.fromCharCode(64 + number)}`))
    const question = await questions().create(questionInput(`pergunta-${number}`))
    const created = [] as string[]
    for (let i = 0; i < 4; i++)
      created.push((await events().create(eventInput(`evento-${number}-${i}`, 1980 + i * 10))).id)
    await puzzles().create({
      number,
      gameDate,
      wordId: word.id,
      questionId: question.id,
      timelineEventIds: created,
      wordOrigin: 'generated',
      questionOrigin: 'generated',
      timelineOrigin: 'generated',
      reviewedBy: null,
      reviewedAt: null,
      publishedAt,
    })
  }

  describe('configurações', () => {
    it('a migration cria a linha única, desligada', async () => {
      const repo = createDrizzleDailySettingsRepository(db)
      expect((await repo.get()).startDate).toBeNull()
    })

    it('grava e lê a data de estreia, e aceita desligar', async () => {
      const repo = createDrizzleDailySettingsRepository(db)
      await repo.setStartDate('2026-12-01', userId, NOW)
      expect(await repo.get()).toEqual({
        startDate: '2026-12-01',
        updatedBy: userId,
        updatedAt: NOW,
      })
      await repo.setStartDate(null, userId, NOW)
      expect((await repo.get()).startDate).toBeNull()
    })

    it('recusa uma segunda linha', async () => {
      await expect(db.insert(schema.dailySettings).values({ id: 2 })).rejects.toThrow()
    })
  })

  describe('palavras', () => {
    it('cria, lê e lista só as ativas', async () => {
      const juros = await words().create(
        wordInput('JUROS', { learnMore: { kind: 'lesson', ref: 'juros-1' } }),
      )
      await words().create(wordInput('SELIC', { active: false }))
      expect(await words().findById(juros.id)).toEqual(juros)
      expect(juros.learnMore).toEqual({ kind: 'lesson', ref: 'juros-1' })
      expect((await words().listActive()).map((w) => w.answer)).toEqual(['JUROS'])
    })

    it('recusa resposta repetida, forma não normalizada e tamanho fora de 4 a 9', async () => {
      await words().create(wordInput('JUROS'))
      await expect(words().create(wordInput('JUROS', { stableKey: 'outra' }))).rejects.toThrow()
      await expect(words().create(wordInput('Ações', { stableKey: 'k1' }))).rejects.toThrow()
      await expect(words().create(wordInput('CDB', { stableKey: 'k2' }))).rejects.toThrow()
      await expect(words().create(wordInput('ABCDEFGHIJ', { stableKey: 'k3' }))).rejects.toThrow()
    })
  })

  describe('palavras aceitas', () => {
    it('addMany é idempotente e isAccepted busca por chave', async () => {
      const repo = createDrizzleAcceptedWordRepository(db)
      expect(await repo.addMany(['JUROS', 'SELIC'], 'extra')).toBe(2)
      expect(await repo.addMany(['JUROS', 'AMOR'], 'vero')).toBe(1)
      expect(await repo.isAccepted('AMOR')).toBe(true)
      expect(await repo.isAccepted('XXXXX')).toBe(false)
    })

    it('recusa forma não normalizada', async () => {
      await expect(
        createDrizzleAcceptedWordRepository(db).addMany(['ações'], 'vero'),
      ).rejects.toThrow()
    })
  })

  describe('perguntas', () => {
    it('cria, lê e lista só as ativas', async () => {
      const a = await questions().create(questionInput('ipca'))
      await questions().create(questionInput('cdi', { active: false, learnMore: null }))
      expect(await questions().findById(a.id)).toEqual(a)
      expect(a.learnMore).toEqual({ kind: 'glossary', ref: 'ipca' })
      expect((await questions().listActive()).map((q) => q.id)).toEqual([a.id])
      expect(await questions().findManyByIds([a.id])).toEqual([a])
      expect(await questions().findManyByIds([])).toEqual([])
    })

    it('exige fonte primária, alternativa certa dentro das opções, marcador válido e vínculo "saiba mais" completo', async () => {
      await expect(questions().create(questionInput('k1', { sourceRef: '   ' }))).rejects.toThrow()
      await expect(questions().create(questionInput('k2', { correctIndex: 4 }))).rejects.toThrow()
      await expect(
        questions().create(questionInput('k3', { options: ['só uma'], correctIndex: 0 })),
      ).rejects.toThrow()
      await expect(questions().create(questionInput('k4', { scope: 'mundo' }))).rejects.toThrow()
      await expect(
        db.insert(schema.dailyQuestions).values({
          ...questionInput('k5'),
          learnMoreKind: 'guide',
          learnMoreRef: null,
        } as never),
      ).rejects.toThrow()
    })

    it('recusa chave repetida', async () => {
      await questions().create(questionInput('ipca'))
      await expect(questions().create(questionInput('ipca'))).rejects.toThrow()
    })
  })

  describe('eventos da Linha do tempo', () => {
    it('cria e lê, inclusive por lista de ids', async () => {
      const a = await events().create(eventInput('plano-real', 1994))
      const b = await events().create(eventInput('plano-collor', 1990))
      expect(await events().findById(a.id)).toEqual(a)
      expect((await events().findManyByIds([a.id, b.id])).map((e) => e.id).sort()).toEqual(
        [a.id, b.id].sort(),
      )
      expect(await events().findManyByIds([])).toEqual([])
      expect((await events().listActive()).map((e) => e.year)).toEqual([1990, 1994])
    })

    it('exige fonte primária, ano plausível e marcador válido', async () => {
      await expect(events().create(eventInput('k1', 1990, { sourceRef: ' ' }))).rejects.toThrow()
      await expect(events().create(eventInput('k2', 900))).rejects.toThrow()
      await expect(events().create(eventInput('k3', 1990, { scope: 'mundo' }))).rejects.toThrow()
    })
  })

  describe('jogos (agenda)', () => {
    it('lista a partir da data em ordem, respeitando o limite', async () => {
      await seedPuzzle(2, '2026-11-04')
      await seedPuzzle(1, '2026-11-03')
      await seedPuzzle(3, '2026-11-05')
      const list = await puzzles().listFromDate('2026-11-04', 10)
      expect(list.map((p) => p.number)).toEqual([2, 3])
      expect((await puzzles().listFromDate('2026-11-03', 2)).map((p) => p.number)).toEqual([1, 2])
      expect((await puzzles().findByDate('2026-11-05'))?.number).toBe(3)
      expect((await puzzles().findByNumber(1))?.gameDate).toBe('2026-11-03')
      expect(await puzzles().findByNumber(99)).toBeNull()
    })

    it('recusa número ou data repetidos', async () => {
      await seedPuzzle(1, '2026-11-03')
      await expect(seedPuzzle(1, '2026-11-09')).rejects.toThrow()
      await expect(seedPuzzle(7, '2026-11-03')).rejects.toThrow()
    })

    it('revisar e publicar gravam quem e quando', async () => {
      await seedPuzzle(1, '2026-11-03')
      await puzzles().markReviewed(1, userId, NOW)
      await puzzles().markPublished(1, NOW)
      expect(await puzzles().findByNumber(1)).toMatchObject({
        reviewedBy: userId,
        reviewedAt: NOW,
        publishedAt: NOW,
      })
    })

    it('replaceUnpublished troca só os não publicados, com a revisão que vier', async () => {
      await seedPuzzle(1, '2026-11-03', NOW)
      await seedPuzzle(2, '2026-11-04')
      await seedPuzzle(3, '2026-11-05')
      const [second] = await puzzles().listFromDate('2026-11-04', 1)

      await puzzles().replaceUnpublished([
        { ...second, number: 9, reviewedBy: userId, reviewedAt: NOW },
      ])

      const all = await puzzles().listFromDate('2026-11-01', 10)
      expect(all.map((p) => [p.number, p.gameDate])).toEqual([
        [1, '2026-11-03'],
        [9, '2026-11-04'],
      ])
      expect(all[1]).toMatchObject({ reviewedBy: userId, reviewedAt: NOW, publishedAt: null })
      expect(all[0].publishedAt).toEqual(NOW)
    })

    it('replaceUnpublished é atômico: se um insert falha, nada muda', async () => {
      await seedPuzzle(1, '2026-11-03')
      const [first] = await puzzles().listFromDate('2026-11-03', 1)
      await expect(
        puzzles().replaceUnpublished([first, { ...first, gameDate: '2026-11-09' }]),
      ).rejects.toThrow()
      expect((await puzzles().listFromDate('2026-11-01', 10)).map((p) => p.number)).toEqual([1])
    })
  })

  describe('agenda de ponta a ponta', () => {
    it('materializa de verdade, é idempotente e realinha ao mudar a estreia', async () => {
      for (let i = 0; i < 12; i++) {
        await words().create(
          wordInput(`PALAV${String.fromCharCode(65 + i)}`, { category: `c${i % 3}` }),
        )
      }
      for (let i = 0; i < 12; i++)
        await questions().create(questionInput(`pergunta-${i}`, { category: `c${i % 4}` }))
      for (let i = 0; i < 30; i++)
        await events().create(eventInput(`evento-${i}`, 1950 + i * 2, { category: `c${i % 4}` }))
      const settings = createDrizzleDailySettingsRepository(db)
      await settings.setStartDate('2026-11-10', userId, NOW)
      const build = () =>
        new MaterializeUpcomingPuzzlesUseCase(
          settings,
          words(),
          questions(),
          events(),
          puzzles(),
          () => NOW,
          {
            horizonDays: 4,
          },
        )

      const first = await build().execute()
      expect(first.created).toEqual([1, 2, 3, 4])
      expect((await build().execute()).created).toEqual([])
      await puzzles().markReviewed(2, userId, NOW)

      await settings.setStartDate('2026-11-11', userId, NOW)
      const moved = await build().execute()
      expect(moved).toMatchObject({ removed: 1, renumbered: 3 })
      const list = await puzzles().listFromDate('2026-11-01', 10)
      expect(list.map((p) => [p.number, p.gameDate])).toEqual([
        [1, '2026-11-11'],
        [2, '2026-11-12'],
        [3, '2026-11-13'],
        [4, '2026-11-14'],
      ])
      expect(list[0].reviewedBy).toBe(userId)
    })
  })

  describe('resultados', () => {
    const base = (): DailyResult => ({
      userId,
      puzzleNumber: 1,
      wordGuesses: ['JUROS'],
      wordCorrect: null,
      questionChoice: null,
      questionCorrect: null,
      timelineOrder: null,
      timelineCorrect: null,
      xpAwarded: 0,
      startedAt: NOW,
      completedAt: null,
    })

    it('save cria e depois substitui a mesma linha (um por usuário e jogo)', async () => {
      await seedPuzzle(1, '2026-11-03')
      const repo = results()
      await repo.save(base())
      expect(await repo.find(userId, 1)).toEqual(base())

      const done: DailyResult = {
        ...base(),
        wordGuesses: ['JUROS', 'SELIC'],
        wordCorrect: true,
        questionChoice: 2,
        questionCorrect: true,
        timelineOrder: ['a', 'b', 'c', 'd'],
        timelineCorrect: false,
        xpAwarded: 40,
        completedAt: NOW,
      }
      await repo.save(done)
      expect(await repo.find(userId, 1)).toEqual(done)
      expect(await repo.listByUser(userId)).toEqual([done])
    })

    it('UNIQUE (usuário, jogo) vale no banco', async () => {
      await seedPuzzle(1, '2026-11-03')
      await db.insert(schema.dailyResults).values({ userId, puzzleNumber: 1 })
      await expect(
        db.insert(schema.dailyResults).values({ userId, puzzleNumber: 1 }),
      ).rejects.toThrow()
    })

    it('recusa resultado de jogo que não existe e XP negativo', async () => {
      await expect(results().save({ ...base(), puzzleNumber: 42 })).rejects.toThrow()
      await seedPuzzle(1, '2026-11-03')
      await expect(results().save({ ...base(), xpAwarded: -1 })).rejects.toThrow()
    })

    it('find devolve null quando a pessoa não jogou', async () => {
      expect(await results().find(userId, 1)).toBeNull()
    })

    it('update cria a linha, grava o que o apply devolve e devolve o valor', async () => {
      await seedPuzzle(1, '2026-11-03')
      const { result, value } = await results().update(userId, 1, NOW, (current) => ({
        next: { ...current, wordGuesses: ['JUROS'] },
        value: 'ok',
      }))
      expect(value).toBe('ok')
      expect(result.wordGuesses).toEqual(['JUROS'])
      expect(result.startedAt).toEqual(NOW)
      expect(await results().find(userId, 1)).toEqual(result)
    })

    it('update cuja função lança não grava nem cria a linha', async () => {
      await seedPuzzle(1, '2026-11-03')
      await expect(
        results().update(userId, 1, NOW, () => {
          throw new Error('recusado')
        }),
      ).rejects.toThrow('recusado')
      expect(await results().find(userId, 1)).toBeNull()
    })

    it('updates simultâneos da mesma linha se enfileiram: nenhuma gravação se perde', async () => {
      await seedPuzzle(1, '2026-11-03')
      const addGuess = (guess: string) =>
        results().update(userId, 1, NOW, (current) => ({
          next: { ...current, wordGuesses: [...current.wordGuesses, guess] },
          value: null,
        }))
      await Promise.all(['A', 'B', 'C', 'D', 'E'].map(addGuess))
      const saved = await results().find(userId, 1)
      expect(saved?.wordGuesses).toHaveLength(5)
      expect([...(saved?.wordGuesses ?? [])].sort()).toEqual(['A', 'B', 'C', 'D', 'E'])
    })

    it('duas abas enviando o último cartão: um só fecha o jogo e um só credita XP', async () => {
      await seedPuzzle(1, '2026-11-03')
      await results().save({
        ...base(),
        wordGuesses: ['JUROS'],
        wordCorrect: true,
        questionChoice: 1,
        questionCorrect: true,
      })
      const xp = createFakeXpAwarder()
      const streak = createFakeStreakTracker()
      const recorder = new DailyProgressRecorder(results(), xp, streak)
      const game = { number: 1, awardsXp: true } as LoadedGame
      const submit = () =>
        recorder.record(userId, game, NOW, (current) => ({
          next: recordTimeline(current, ['a', 'b', 'c', 'd'], true),
          value: null,
        }))

      const outcomes = await Promise.allSettled(Array.from({ length: 4 }, submit))
      expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1)
      const rejected = outcomes.filter((o) => o.status === 'rejected')
      expect(rejected).toHaveLength(3)
      for (const r of rejected)
        expect((r as PromiseRejectedResult).reason).toBeInstanceOf(CardAlreadyAnsweredError)
      expect(xp.awarded).toEqual([{ userId, amount: 50, reason: 'diario:1' }])
      expect(streak.touchedUserIds).toEqual([userId])
      expect((await results().find(userId, 1))?.xpAwarded).toBe(50)
    })
  })
  describe('painel (DI.5.1)', () => {
    it('palavra: listAll traz as desativadas e update troca só os campos informados', async () => {
      const w = await words().create(wordInput('SELIC'))
      await words().create(wordInput('COPOM', { active: false }))
      expect((await words().listAll()).map((x) => x.answer)).toEqual(['COPOM', 'SELIC'])

      const updated = await words().update(
        w.id,
        { definition: 'Nova.', learnMore: { kind: 'glossary', ref: 'Selic' } },
        userId,
      )
      expect(updated).toMatchObject({
        answer: 'SELIC',
        definition: 'Nova.',
        learnMore: { kind: 'glossary', ref: 'Selic' },
        category: 'juros',
      })
      const cleared = await words().update(w.id, { learnMore: null }, userId)
      expect(cleared?.learnMore).toBeNull()
      expect(await words().update('00000000-0000-4000-8000-000000000000', {}, userId)).toBeNull()
    })

    it('pergunta e evento: editar tira a revisão, markReviewed marca, e o patch pode preservá-la', async () => {
      const q = await questions().create(questionInput('q1'))
      const e = await events().create(eventInput('e1', 1994))
      await questions().markReviewed([q.id], userId, NOW)
      await events().markReviewed([e.id], userId, NOW)
      expect((await questions().findById(q.id))?.reviewedAt).toEqual(NOW)

      await questions().update(q.id, { active: false, reviewedAt: NOW }, userId)
      expect((await questions().findById(q.id))?.reviewedAt).toEqual(NOW)
      await questions().update(q.id, { question: 'Outra?' }, userId)
      expect(await questions().findById(q.id)).toMatchObject({
        question: 'Outra?',
        reviewedAt: null,
      })
      await events().update(e.id, { label: 'Outro' }, userId)
      expect((await events().findById(e.id))?.reviewedAt).toBeNull()
      expect((await events().listAll()).map((x) => x.label)).toEqual(['Outro'])
    })

    it('lista extra: lista, adiciona e remove só a extra, nunca a do dicionário', async () => {
      const repo = createDrizzleAcceptedWordRepository(db)
      await repo.addMany(['JUROS'], 'vero')
      await repo.addMany(['COPOM', 'SELIC'], 'extra')
      expect(await repo.listExtra()).toEqual(['COPOM', 'SELIC'])
      expect(await repo.removeExtra('JUROS')).toBe(false)
      expect(await repo.isAccepted('JUROS')).toBe(true)
      expect(await repo.removeExtra('COPOM')).toBe(true)
      expect(await repo.isAccepted('COPOM')).toBe(false)
    })

    it('jogos: listUsing acha por palavra, pergunta e evento (jsonb)', async () => {
      await seedPuzzle(1, '2026-11-03')
      await seedPuzzle(2, '2026-11-04')
      const one = (await puzzles().findByNumber(1))!
      expect((await puzzles().listUsing('word', one.wordId)).map((p) => p.number)).toEqual([1])
      expect((await puzzles().listUsing('question', one.questionId)).map((p) => p.number)).toEqual([
        1,
      ])
      expect(
        (await puzzles().listUsing('event', one.timelineEventIds[2])).map((p) => p.number),
      ).toEqual([1])
      expect(await puzzles().listUsing('event', '00000000-0000-4000-8000-000000000000')).toEqual([])
    })

    it('jogos: updateCard marca manual e zera a revisão; clearReview poupa o publicado', async () => {
      await seedPuzzle(1, '2026-11-03')
      await seedPuzzle(2, '2026-11-04', NOW)
      await puzzles().markReviewed(1, userId, NOW)
      await puzzles().markReviewed(2, userId, NOW)
      const other = await words().create(wordInput('OUTRAX'))

      await puzzles().updateCard(1, { card: 'word', wordId: other.id })
      expect(await puzzles().findByNumber(1)).toMatchObject({
        wordId: other.id,
        wordOrigin: 'manual',
        questionOrigin: 'generated',
        reviewedAt: null,
        reviewedBy: null,
      })

      await puzzles().clearReview([1, 2])
      expect((await puzzles().findByNumber(2))?.reviewedAt).toEqual(NOW)
    })

    it('jogos: publishReviewed publica só os revisados e unpublishFrom tira do ar por data', async () => {
      await seedPuzzle(1, '2026-11-03')
      await seedPuzzle(2, '2026-11-04')
      await seedPuzzle(3, '2026-11-05')
      await puzzles().markReviewed(1, userId, NOW)
      await puzzles().markReviewed(3, userId, NOW)

      expect(await puzzles().publishReviewed('1970-01-01', NOW)).toEqual([1, 3])
      expect((await puzzles().findByNumber(2))?.publishedAt).toBeNull()
      expect(await puzzles().publishReviewed('1970-01-01', NOW)).toEqual([])

      expect(await puzzles().unpublishFrom('2026-11-04')).toBe(1)
      expect((await puzzles().findByNumber(1))?.publishedAt).toEqual(NOW)
      expect((await puzzles().findByNumber(3))?.publishedAt).toBeNull()
    })
  })
  describe('contadores (DI.7.1)', () => {
    it('increment soma por dia e métrica, também sob concorrência', async () => {
      const repo = createDrizzleDailyMetricsRepository(db)

      await Promise.all(
        Array.from({ length: 10 }, () => repo.increment('2026-11-03', 'anon_started')),
      )
      await repo.increment('2026-11-03', 'anon_completed')
      await repo.increment('2026-11-04', 'anon_started')

      const rows = await repo.listStored('2026-11-03', '2026-11-03')
      expect(rows).toEqual(
        expect.arrayContaining([
          { date: '2026-11-03', metric: 'anon_started', count: 10 },
          { date: '2026-11-03', metric: 'anon_completed', count: 1 },
        ]),
      )
      expect(rows).toHaveLength(2)
      expect(await repo.listStored('2026-11-01', '2026-11-30')).toHaveLength(3)
    })

    it('o banco recusa métrica fora da lista', async () => {
      await expect(
        db
          .insert(schema.dailyMetrics)
          .values({ metricDate: '2026-11-03', metric: 'user_id', count: 1 }),
      ).rejects.toThrow()
    })

    it('listLoggedGames bate com daily_results: início pelo dia UTC de started_at, fim pelo de completed_at', async () => {
      await seedPuzzle(1, '2026-11-03')
      await seedPuzzle(2, '2026-11-04')
      await db.insert(schema.dailyResults).values([
        {
          userId,
          puzzleNumber: 1,
          startedAt: new Date('2026-11-03T23:50:00Z'),
          completedAt: new Date('2026-11-04T00:10:00Z'),
          xpAwarded: 0,
        },
        { userId, puzzleNumber: 2, startedAt: new Date('2026-11-04T10:00:00Z'), completedAt: null },
      ])

      const rows = await createDrizzleDailyMetricsRepository(db).listLoggedGames(
        '2026-11-03',
        '2026-11-04',
      )

      const byDate = Object.fromEntries(rows.map((r) => [r.date, r]))
      expect(byDate['2026-11-03']).toMatchObject({ started: 1, completed: 0 })
      expect(byDate['2026-11-04']).toMatchObject({ started: 1, completed: 1 })
      expect(
        await createDrizzleDailyMetricsRepository(db).listLoggedGames('2026-11-05', '2026-11-06'),
      ).toEqual([])
    })
  })
})
