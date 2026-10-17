import path from 'node:path'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Database } from '../../../../db/client'
import * as schema from '../../../../db/schema'
import type { DailyResult } from '../../domain/content'
import { createDrizzleAcceptedWordRepository } from './drizzleAcceptedWordRepository'
import { createDrizzleDailyFactRepository } from './drizzleDailyFactRepository'
import { createDrizzleDailyPuzzleRepository } from './drizzleDailyPuzzleRepository'
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

const factInput = (key: string, year: number, extra: Record<string, unknown> = {}) => ({
  stableKey: key,
  eventDate: `${year}-07-01`,
  question: 'Pergunta?',
  options: ['A', 'B', 'C', 'D'],
  correctIndex: 2,
  explanation: 'Porque sim.',
  timelineLabel: key,
  sourceRef: 'Banco Central do Brasil',
  learnMore: { kind: 'glossary' as const, ref: 'selic' },
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
  const facts = () => createDrizzleDailyFactRepository(db)
  const puzzles = () => createDrizzleDailyPuzzleRepository(db)
  const results = () => createDrizzleDailyResultRepository(db)

  async function clean() {
    await db.delete(schema.dailyResults)
    await db.delete(schema.dailyPuzzles)
    await db.delete(schema.dailyFacts)
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
    const created = [] as string[]
    for (let i = 0; i < 4; i++)
      created.push((await facts().create(factInput(`fato-${number}-${i}`, 1980 + i * 10))).id)
    await puzzles().create({
      number,
      gameDate,
      wordId: word.id,
      factId: created[0],
      timelineFactIds: created,
      wordOrigin: 'generated',
      factOrigin: 'generated',
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

  describe('fatos', () => {
    it('cria e lê, inclusive por lista de ids', async () => {
      const a = await facts().create(factInput('plano-real', 1994))
      const b = await facts().create(
        factInput('plano-collor', 1990, { timelineLabel: null, learnMore: null }),
      )
      expect(await facts().findById(a.id)).toEqual(a)
      expect(b.timelineLabel).toBeNull()
      expect((await facts().findManyByIds([a.id, b.id])).map((f) => f.id).sort()).toEqual(
        [a.id, b.id].sort(),
      )
      expect(await facts().findManyByIds([])).toEqual([])
    })

    it('exige fonte primária, alternativa certa dentro das opções e vínculo "saiba mais" completo', async () => {
      await expect(facts().create(factInput('k1', 1990, { sourceRef: '   ' }))).rejects.toThrow()
      await expect(facts().create(factInput('k2', 1990, { correctIndex: 4 }))).rejects.toThrow()
      await expect(
        facts().create(factInput('k3', 1990, { options: ['só uma'], correctIndex: 0 })),
      ).rejects.toThrow()
      await expect(facts().create(factInput('k4', 1990, { scope: 'mundo' }))).rejects.toThrow()
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

    it('apagar a partir de uma data nunca toca jogo publicado', async () => {
      await seedPuzzle(1, '2026-11-03', NOW)
      await seedPuzzle(2, '2026-11-04')
      await seedPuzzle(3, '2026-11-05')
      expect(await puzzles().deleteUnpublishedFromDate('2026-11-03')).toBe(2)
      expect((await puzzles().listFromDate('2026-11-01', 10)).map((p) => p.number)).toEqual([1])
    })
  })

  describe('resultados', () => {
    const base = (): DailyResult => ({
      userId,
      puzzleNumber: 1,
      wordGuesses: ['JUROS'],
      wordCorrect: null,
      factChoice: null,
      factCorrect: null,
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
        factChoice: 2,
        factCorrect: true,
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
  })
})
