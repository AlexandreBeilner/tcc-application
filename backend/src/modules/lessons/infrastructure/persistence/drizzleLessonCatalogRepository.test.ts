import path from 'node:path'
import { inArray, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../../../db/schema'
import { createDrizzleLessonCatalogRepository } from './drizzleLessonCatalogRepository'
import { createDrizzleLessonRepository } from './drizzleLessonRepository'

// Integração do adapter real: só roda com TEST_DATABASE_URL apontando pra um banco
// DESCARTÁVEL (aplica as migrations e grava lições/usuários). Nunca o `gamification` de dev.
// Com mais de um arquivo de integração no mesmo banco, rode com `--no-file-parallelism`.
const databaseUrl = process.env.TEST_DATABASE_URL

describe.skipIf(!databaseUrl)('drizzleLessonCatalogRepository (banco real)', () => {
  let pool: Pool
  let db: ReturnType<typeof drizzle<typeof schema>>
  const suffix = Date.now().toString(36)
  const lessonIds: string[] = []
  const userIds: string[] = []

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl })
    db = drizzle(pool, { schema })
    await migrate(db, { migrationsFolder: path.join(__dirname, '../../../../db/migrations') })

    // Posições altas pra não colidir com o seed real caso o banco tenha lições.
    const base = 9_000_000 + (Date.now() % 100_000) * 10
    const rows = await db
      .insert(schema.lessons)
      .values(
        [0, 1, 2, 3].map((i) => ({
          stableKey: `t${suffix}${i}`.slice(0, 20),
          code: `t${suffix}${i}`.slice(0, 10),
          trackNumber: 99,
          trackName: 'Trilha de teste',
          sortOrder: base + i,
          title: `Lição ${i}`,
          centralConcept: 'conceito',
          // A lição 1 tem aposta real: a escolha certa é o índice 1.
          microDecisionOptions: i === 1 ? ['a', 'b'] : null,
          microDecisionCorrectOption: i === 1 ? 1 : null,
        })),
      )
      .returning({ id: schema.lessons.id, sortOrder: schema.lessons.sortOrder })
    lessonIds.push(...rows.sort((a, b) => a.sortOrder - b.sortOrder).map((r) => r.id))

    const users = await db
      .insert(schema.users)
      .values(
        ['u1', 'u2', 'u3', 'u4'].map((n) => ({
          name: n,
          email: `${n}-${suffix}@t.dev`,
          username: `${n}${suffix}`,
          passwordHash: 'h',
        })),
      )
      .returning({ id: schema.users.id, username: schema.users.username })
    userIds.push(...users.sort((a, b) => a.username.localeCompare(b.username)).map((u) => u.id))
  })

  afterAll(async () => {
    await pool.end()
  })

  const catalog = () => createDrizzleLessonCatalogRepository(db)
  const funnelOf = async (lessonId: string) =>
    (await catalog().listWithFunnel()).find((row) => row.lesson.id === lessonId)

  it('funil: conta quem iniciou, concluiu, o tempo, a aposta e o abandono por passo; dispensa nunca aberta fica de fora', async () => {
    const [l0, l1] = lessonIds
    const t0 = new Date('2026-10-01T10:00:00Z')
    // u1 concluiu a lição 1 em 2 min acertando a aposta; u2 concluiu em 4 min errando;
    // u3 parou no passo 2; u4 só recebeu dispensa (nunca abriu).
    await db.insert(schema.userLessonProgress).values([
      {
        userId: userIds[0],
        lessonId: l1,
        currentStep: 3,
        startedAt: t0,
        completedAt: new Date(t0.getTime() + 120_000),
        microDecisionSelectedOption: 1,
      },
      {
        userId: userIds[1],
        lessonId: l1,
        currentStep: 3,
        startedAt: t0,
        completedAt: new Date(t0.getTime() + 240_000),
        microDecisionSelectedOption: 0,
      },
      { userId: userIds[2], lessonId: l1, currentStep: 2, startedAt: t0 },
      { userId: userIds[3], lessonId: l1, currentStep: 0, startedAt: t0, waivedAt: t0 },
    ])

    const row = await funnelOf(l1)

    expect(row?.funnel).toEqual({
      started: 3,
      completed: 2,
      avgSecondsToComplete: 180,
      medianSecondsToComplete: 180,
      betAnswered: 2,
      betCorrect: 1,
      abandonedByStep: [0, 0, 1, 0],
    })
    // Lição sem nenhum progresso devolve o funil zerado.
    expect((await funnelOf(l0))?.funnel.started).toBe(0)
  })

  it('despublicar tira a lição da lista do jogador sem apagar o progresso; o catálogo do painel ainda a vê', async () => {
    const l1 = lessonIds[1]
    const player = createDrizzleLessonRepository(db)

    const result = await catalog().setPublished(l1, false)

    expect(result?.lesson.published).toBe(false)
    expect(result?.waivedUsers).toBe(0)
    expect((await player.listAll()).some((l) => l.id === l1)).toBe(false)
    expect((await funnelOf(l1))?.funnel.completed).toBe(2)
    expect((await funnelOf(l1))?.lesson.published).toBe(false)
  })

  it('publicar de volta dispensa só quem já tinha passado da posição, sem tocar quem concluiu nem quem está antes', async () => {
    const l1 = lessonIds[1]
    const now = new Date()
    // Só o progresso dos usuários desta suíte é refeito. A posição que l1 ocupa ao ser publicada
    // é o número de publicadas até o `sort_order` dela (contando ela mesma).
    await db
      .delete(schema.userLessonProgress)
      .where(inArray(schema.userLessonProgress.userId, userIds))
    const position = await db.execute<{ n: number }>(
      sql`SELECT COUNT(*)::int AS n FROM lessons WHERE (published OR id = ${l1}::uuid) AND sort_order <= (SELECT sort_order FROM lessons WHERE id = ${l1}::uuid)`,
    )
    const pos = position.rows[0].n
    const published = await db.execute<{ id: string }>(
      sql`SELECT id FROM lessons WHERE published ORDER BY sort_order`,
    )
    const publishedIds = published.rows.map((r) => r.id)
    expect(publishedIds.length).toBeGreaterThanOrEqual(pos)
    const satisfy = (userId: string, ids: string[]) =>
      db
        .insert(schema.userLessonProgress)
        .values(ids.map((lessonId) => ({ userId, lessonId, currentStep: 3, completedAt: now })))
    // u1 satisfez `pos` lições (já passou do ponto); u2 satisfez `pos - 1` (a próxima a fazer seria
    // a l1); u3 concluiu a própria l1 antes de ela ser despublicada e não pode virar dispensa.
    await satisfy(userIds[0], publishedIds.slice(0, pos))
    await satisfy(userIds[1], publishedIds.slice(0, pos - 1))
    await db
      .insert(schema.userLessonProgress)
      .values({ userId: userIds[2], lessonId: l1, currentStep: 3, completedAt: now })

    const result = await catalog().setPublished(l1, true)

    expect(result?.lesson.published).toBe(true)
    const rows = await db
      .select()
      .from(schema.userLessonProgress)
      .where(inArray(schema.userLessonProgress.userId, userIds))
    const l1Rows = new Map(rows.filter((r) => r.lessonId === l1).map((r) => [r.userId, r]))
    expect(l1Rows.get(userIds[0])?.waivedAt).not.toBeNull()
    expect(l1Rows.get(userIds[0])?.completedAt).toBeNull()
    expect(l1Rows.has(userIds[1])).toBe(false)
    expect(l1Rows.get(userIds[2])?.completedAt).not.toBeNull()
    expect(l1Rows.get(userIds[2])?.waivedAt).toBeNull()
    expect(result?.waivedUsers).toBeGreaterThanOrEqual(1)
  })

  it('lição inexistente devolve undefined', async () => {
    expect(
      await catalog().setPublished('6f9619ff-8b86-d011-b42d-00c04fc964ff', false),
    ).toBeUndefined()
  })
})
