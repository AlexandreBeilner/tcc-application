import path from 'node:path'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from './schema'
import type { Database } from './client'
import { seedDailyContent } from './seedDaily'
import { INITIAL_CONTENT } from '../modules/daily/content/dailyContent'
import { EXTRA_ACCEPTED_WORDS } from '../modules/daily/content/extraAcceptedWords'
import { readAcceptedWordsFile } from '../modules/daily/content/acceptedWordsFile'

// Teste de integração (DI.1.4): só roda com TEST_DATABASE_URL apontando para um banco DESCARTÁVEL
// (apaga as tabelas `daily_*`). Prova o que o seed promete: carrega tudo na primeira vez, não muda
// nada na segunda e nunca sobrescreve o que o painel editou.
const databaseUrl = process.env.TEST_DATABASE_URL

describe.skipIf(!databaseUrl)('seed do conteúdo do Diário (banco real)', () => {
  let pool: Pool
  let db: Database

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl })
    const drizzleDb = drizzle(pool, { schema })
    await migrate(drizzleDb, { migrationsFolder: path.join(__dirname, 'migrations') })
    db = drizzleDb as unknown as Database
    await db.delete(schema.dailyResults)
    await db.delete(schema.dailyPuzzles)
    await db.delete(schema.dailyWords)
    await db.delete(schema.dailyQuestions)
    await db.delete(schema.dailyEvents)
    await db.delete(schema.dailyAcceptedWords)
  })

  afterAll(async () => {
    await pool.end()
  })

  it('carrega tudo na primeira vez e não altera nada na segunda', async () => {
    const vero = readAcceptedWordsFile()
    const first = await seedDailyContent(db)
    expect(first.words).toBe(INITIAL_CONTENT.words.length)
    expect(first.questions).toBe(INITIAL_CONTENT.questions.length)
    expect(first.events).toBe(INITIAL_CONTENT.events.length)
    expect(first.acceptedVero).toBe(vero.length)
    const extrasOutsideVero = EXTRA_ACCEPTED_WORDS.filter((w) => !new Set(vero).has(w))
    expect(first.acceptedExtra).toBe(extrasOutsideVero.length)

    const second = await seedDailyContent(db)
    expect(second).toEqual({ acceptedVero: 0, acceptedExtra: 0, words: 0, questions: 0, events: 0 })

    const [{ n }] = (await pool.query('select count(*)::int as n from daily_accepted_words')).rows
    expect(n).toBe(vero.length + extrasOutsideVero.length)
  }, 300_000)

  it('toda palavra-resposta gravada está na lista aceita', async () => {
    const orphans = await pool.query(
      'select w.answer from daily_words w left join daily_accepted_words a on a.word = w.answer where a.word is null',
    )
    expect(orphans.rows).toEqual([])
  })

  it('grava fonte, categoria e marcador de cada pergunta e evento, sem revisão', async () => {
    const questions = await db.select().from(schema.dailyQuestions)
    const events = await db.select().from(schema.dailyEvents)
    for (const row of [...questions, ...events]) {
      expect(row.sourceRef.trim().length).toBeGreaterThan(0)
      expect(['brasil', 'fora']).toContain(row.scope)
      expect(row.category.length).toBeGreaterThan(0)
      expect(row.reviewedAt).toBeNull()
    }
  })

  it('nunca sobrescreve o que o painel editou', async () => {
    const word = INITIAL_CONTENT.words[0]
    const [before] = await db.select().from(schema.dailyWords).limit(1)
    await db
      .update(schema.dailyWords)
      .set({ definition: 'Texto editado no painel.', active: false })
      .where(eq(schema.dailyWords.id, before.id))
    const [question] = await db.select().from(schema.dailyQuestions).limit(1)
    await db
      .update(schema.dailyQuestions)
      .set({ explanation: 'Explicação editada no painel.' })
      .where(eq(schema.dailyQuestions.id, question.id))

    const summary = await seedDailyContent(db)
    expect(summary).toEqual({
      acceptedVero: 0,
      acceptedExtra: 0,
      words: 0,
      questions: 0,
      events: 0,
    })

    const [after] = await db
      .select()
      .from(schema.dailyWords)
      .where(eq(schema.dailyWords.id, before.id))
    expect(after.definition).toBe('Texto editado no painel.')
    expect(after.active).toBe(false)
    expect(word.display).toBeTruthy()
    const [q] = await db
      .select()
      .from(schema.dailyQuestions)
      .where(eq(schema.dailyQuestions.id, question.id))
    expect(q.explanation).toBe('Explicação editada no painel.')
  }, 120_000)

  it('recusa gravar quando uma resposta não está na lista aceita', async () => {
    await expect(
      seedDailyContent(
        db,
        {
          ...INITIAL_CONTENT,
          words: [
            { display: 'XPTOQ', definition: 'd', category: 'economia-geral', scope: 'brasil' },
          ],
        },
        ['JUROS'],
        [],
      ),
    ).rejects.toThrow(/fora da lista aceita/)
  })
})
