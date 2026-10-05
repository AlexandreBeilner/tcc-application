import path from 'node:path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../../../db/schema'
import { createDrizzleMissionRepository } from './drizzleMissionRepository'

// Integração do adapter real: só roda com TEST_DATABASE_URL apontando pra um banco
// DESCARTÁVEL (aplica as migrations e grava missões e usuários). Nunca o `gamification` de dev.
// Rode com `--no-file-parallelism` junto dos outros arquivos de integração.
const databaseUrl = process.env.TEST_DATABASE_URL

describe.skipIf(!databaseUrl)('drizzleMissionRepository (banco real)', () => {
  let pool: Pool
  let db: ReturnType<typeof drizzle<typeof schema>>
  const suffix = Date.now().toString(36)

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl })
    db = drizzle(pool, { schema })
    await migrate(db, { migrationsFolder: path.join(__dirname, '../../../../db/migrations') })
  })

  afterAll(async () => {
    await pool.end()
  })

  async function newUser(label: string) {
    const [user] = await db
      .insert(schema.users)
      .values({
        name: label,
        email: `${label}-${suffix}@t.dev`,
        username: `${label}${suffix}`.slice(0, 30),
      })
      .returning()
    return user
  }

  async function newMission(key: string) {
    const [mission] = await db
      .insert(schema.dailyMissions)
      .values({
        key: `${key}_${suffix}`,
        title: `Missão ${key}`,
        completionCriteria: 'teste',
        xpReward: 30,
      })
      .returning()
    return mission
  }

  it('o catálogo do dia só tem as ativas, e listAll traz todas', async () => {
    const repo = createDrizzleMissionRepository(db)
    const mission = await newMission('ativa')

    await repo.update(mission.id, { isActive: false })

    expect((await repo.listCatalog()).some((m) => m.id === mission.id)).toBe(false)
    expect((await repo.listAll()).find((m) => m.id === mission.id)?.isActive).toBe(false)
    expect((await repo.findById(mission.id))?.isActive).toBe(false)

    await repo.update(mission.id, { isActive: true })
    expect((await repo.listCatalog()).some((m) => m.id === mission.id)).toBe(true)
  })

  it('missão nova nasce ativa (default da migration 0021)', async () => {
    const repo = createDrizzleMissionRepository(db)
    const mission = await newMission('default')

    expect((await repo.findById(mission.id))?.isActive).toBe(true)
  })

  it('edita título, descrição e XP sem tocar a key nem o tipo de verificação', async () => {
    const repo = createDrizzleMissionRepository(db)
    const mission = await newMission('edita')

    const updated = await repo.update(mission.id, {
      title: 'Novo título',
      description: null,
      xpReward: 55,
    })

    expect(updated).toMatchObject({
      key: mission.key,
      title: 'Novo título',
      description: null,
      xpReward: 55,
      requiresLessonCompletion: false,
    })
    expect(
      await repo.update('00000000-0000-4000-8000-000000000000', { xpReward: 5 }),
    ).toBeUndefined()
    expect(await repo.update(mission.id, {})).toMatchObject({ title: 'Novo título' })
  })

  it('conta usuários distintos que concluíram, no total e no dia, e desativar não apaga o histórico', async () => {
    const repo = createDrizzleMissionRepository(db)
    const mission = await newMission('conta')
    const [a, b] = await Promise.all([newUser('missa'), newUser('missb')])
    await repo.markCompleted(a.id, mission.id, '2026-10-03')
    await repo.markCompleted(a.id, mission.id, '2026-10-02')
    await repo.markCompleted(b.id, mission.id, '2026-10-02')
    await repo.ensureTodayProgress(b.id, [mission.id], '2026-10-03')

    await repo.update(mission.id, { isActive: false })
    const counts = await repo.countCompletions('2026-10-03')

    expect(counts.get(mission.id)).toEqual({ users: 2, today: 1 })
    expect(
      (await repo.listAllProgressForUser(a.id)).filter((p) => p.missionId === mission.id),
    ).toHaveLength(2)
  })
})
