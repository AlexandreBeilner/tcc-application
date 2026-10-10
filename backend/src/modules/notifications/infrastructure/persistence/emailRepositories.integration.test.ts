import path from 'node:path'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Database } from '../../../../db/client'
import * as schema from '../../../../db/schema'
import { createDrizzleAchievementRarityReader } from '../../../achievements/infrastructure/persistence/drizzleAchievementRarityReader'
import { createDrizzleEmailOutboxHealthReader } from '../../../admin/infrastructure/health/emailOutboxHealthReader'
import { createDrizzleEmailOutboxRepository } from './drizzleEmailOutboxRepository'
import { createDrizzleEmailPreferencesRepository } from './drizzleEmailPreferencesRepository'
import { createDrizzleEmailSuppressionRepository } from './drizzleEmailSuppressionRepository'
import { createDrizzleRecipientDirectory } from './drizzleRecipientDirectory'
import { createDrizzleStreakReminderAudience } from './drizzleStreakReminderAudience'
import { createDrizzleWeeklyDigestAudience } from './drizzleWeeklyDigestAudience'

// Teste de integração (EM.1.1 e EM.1.4): outbox e supressão num arquivo só, porque dois arquivos migrando o mesmo banco em paralelo colidem. Só roda com TEST_DATABASE_URL apontando pra um banco
// DESCARTÁVEL (apaga `email_outbox`). Cobre o que os fakes não provam: idempotência pela UNIQUE
// real e a reivindicação com `FOR UPDATE SKIP LOCKED` em conexões concorrentes.
const databaseUrl = process.env.TEST_DATABASE_URL
const T0 = new Date('2026-10-09T12:00:00Z')

// `sendAt` fixo no passado: sem ele a linha nasce com o relógio do banco, que pode ser
// posterior ao `now` fixo que os testes passam pro worker.
const base = (key: string) => ({
  sendAt: new Date('2026-10-09T11:00:00Z'),
  userId: null,
  toAddress: 'ana@exemplo.com',
  templateKey: 'test',
  category: 'transactional' as const,
  payload: { key },
  idempotencyKey: key,
})

describe.skipIf(!databaseUrl)('repositórios de e-mail (banco real)', () => {
  let pool: Pool
  let db: Database

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl, max: 10 })
    const drizzleDb = drizzle(pool, { schema })
    await migrate(drizzleDb, {
      migrationsFolder: path.join(__dirname, '../../../../db/migrations'),
    })
    db = drizzleDb as unknown as Database
  })

  beforeEach(async () => {
    await db.delete(schema.emailOutbox)
    await db.delete(schema.emailSuppressions)
    await db.delete(schema.emailPreferences)
  })

  afterAll(async () => {
    await pool.end()
  })

  it('enqueue é idempotente pela chave', async () => {
    const repo = createDrizzleEmailOutboxRepository(db)

    const first = await repo.enqueue(base('k1'))
    const second = await repo.enqueue({ ...base('k1'), payload: { outro: true } })

    expect(first.created).toBe(true)
    expect(second).toEqual({ id: first.id, created: false })
    const rows = await db.select().from(schema.emailOutbox)
    expect(rows).toHaveLength(1)
    expect(rows[0].payload).toEqual({ key: 'k1' })
  })

  it('claimBatch pega só pending vencida, incrementa tentativas e marca sending', async () => {
    const repo = createDrizzleEmailOutboxRepository(db)
    const now = new Date('2026-10-09T12:00:00Z')
    await repo.enqueue(base('vencida'))
    await repo.enqueue({ ...base('futura'), sendAt: new Date('2026-10-09T13:00:00Z') })

    const batch = await repo.claimBatch(10, now)

    expect(batch.map((e) => e.idempotencyKey)).toEqual(['vencida'])
    expect(batch[0]).toMatchObject({ status: 'sending', attempts: 1 })
    expect(await repo.claimBatch(10, now)).toEqual([])
  })

  it('reivindicações concorrentes nunca pegam a mesma linha (SKIP LOCKED)', async () => {
    const repo = createDrizzleEmailOutboxRepository(db)
    const now = new Date('2026-10-09T12:00:00Z')
    for (let i = 0; i < 30; i += 1) {
      await repo.enqueue(base(`c${i}`))
    }

    const claims = await Promise.all(Array.from({ length: 6 }, () => repo.claimBatch(10, now)))

    const ids = claims.flat().map((e) => e.id)
    expect(ids).toHaveLength(30)
    expect(new Set(ids).size).toBe(30)
  })

  it('markForRetry devolve pra pending, markSent e markFailed fecham a linha', async () => {
    const repo = createDrizzleEmailOutboxRepository(db)
    const now = new Date('2026-10-09T12:00:00Z')
    const a = await repo.enqueue(base('a'))
    const b = await repo.enqueue(base('b'))
    const c = await repo.enqueue(base('c'))
    await repo.claimBatch(10, now)

    await repo.markForRetry(a.id, 'timeout', new Date('2026-10-09T12:01:00Z'))
    await repo.markSent(b.id, 'msg-1', now)
    await repo.markFailed(c.id, 'inválido')

    const rows = Object.fromEntries(
      (await db.select().from(schema.emailOutbox)).map((r) => [r.idempotencyKey, r]),
    )
    expect(rows.a).toMatchObject({ status: 'pending', lastError: 'timeout', attempts: 1 })
    expect(rows.b).toMatchObject({ status: 'sent', providerMessageId: 'msg-1' })
    expect(rows.b.sentAt).toEqual(now)
    expect(rows.c).toMatchObject({ status: 'failed', lastError: 'inválido' })
  })

  it('markSent e markFailed apagam do payload só os campos pedidos', async () => {
    const repo = createDrizzleEmailOutboxRepository(db)
    const now = new Date('2026-10-09T12:00:00Z')
    const withLink = (key: string) => ({
      ...base(key),
      payload: { name: 'Ana', resetUrl: 'https://app/x#token=segredo' },
    })
    const a = await repo.enqueue(withLink('sa'))
    const b = await repo.enqueue(withLink('sb'))
    const c = await repo.enqueue(withLink('sc'))
    await repo.claimBatch(10, now)

    await repo.markSent(a.id, 'msg-s', now, ['resetUrl'])
    await repo.markFailed(b.id, 'inválido', ['resetUrl', 'naoExiste'])
    await repo.markSent(c.id, 'msg-c', now)

    const rows = Object.fromEntries(
      (await db.select().from(schema.emailOutbox)).map((r) => [r.idempotencyKey, r]),
    )
    expect(rows.sa.payload).toEqual({ name: 'Ana' })
    expect(rows.sb.payload).toEqual({ name: 'Ana' })
    expect(rows.sc.payload).toEqual({ name: 'Ana', resetUrl: 'https://app/x#token=segredo' })
  })

  it('recoverStuck devolve sending antigo pra pending e falha o que esgotou tentativas', async () => {
    const repo = createDrizzleEmailOutboxRepository(db)
    const claimedAt = new Date('2026-10-09T12:00:00Z')
    await repo.enqueue(base('preso'))
    await repo.enqueue(base('esgotado'))
    await repo.claimBatch(10, claimedAt)
    await db
      .update(schema.emailOutbox)
      .set({ attempts: 5 })
      .where(eq(schema.emailOutbox.idempotencyKey, 'esgotado'))

    const tooSoon = await repo.recoverStuck(new Date('2026-10-09T11:59:00Z'), 5)
    const recovered = await repo.recoverStuck(new Date('2026-10-09T12:10:00Z'), 5)

    expect(tooSoon).toBe(0)
    expect(recovered).toBe(2)
    const rows = Object.fromEntries(
      (await db.select().from(schema.emailOutbox)).map((r) => [r.idempotencyKey, r]),
    )
    expect(rows.preso.status).toBe('pending')
    expect(rows.esgotado.status).toBe('failed')
  })

  it('enqueue com suppressedBy grava suppressed e o worker nunca reivindica', async () => {
    const repo = createDrizzleEmailOutboxRepository(db)

    await repo.enqueue({ ...base('barrado'), suppressedBy: 'bounce' })

    const [row] = await db.select().from(schema.emailOutbox)
    expect(row).toMatchObject({ status: 'suppressed', lastError: 'suppressed:bounce' })
    expect(await repo.claimBatch(10, new Date('2026-10-09T12:00:00Z'))).toEqual([])
  })

  it('markSuppressed fecha a linha reivindicada e markDelivered acha pelo id do provedor', async () => {
    const repo = createDrizzleEmailOutboxRepository(db)
    const now = new Date('2026-10-09T12:00:00Z')
    const a = await repo.enqueue(base('a'))
    const b = await repo.enqueue(base('b'))
    await repo.claimBatch(10, now)

    await repo.markSuppressed(a.id, 'complaint')
    await repo.markSent(b.id, 'msg-77', now)
    await repo.markDelivered('msg-77', new Date('2026-10-09T12:00:05Z'))

    const rows = Object.fromEntries(
      (await db.select().from(schema.emailOutbox)).map((r) => [r.idempotencyKey, r]),
    )
    expect(rows.a).toMatchObject({ status: 'suppressed', lastError: 'suppressed:complaint' })
    expect(rows.b.deliveredAt).toEqual(new Date('2026-10-09T12:00:05Z'))
  })

  it('find devolve null pra endereço limpo e o motivo pra suprimido', async () => {
    const repo = createDrizzleEmailSuppressionRepository(db)
    expect(await repo.find('ana@exemplo.com')).toBeNull()

    await repo.add('ana@exemplo.com', 'complaint', T0)

    expect(await repo.find('ana@exemplo.com')).toBe('complaint')
  })

  it('add é idempotente e só sobe de gravidade, nunca desce', async () => {
    const repo = createDrizzleEmailSuppressionRepository(db)

    await repo.add('ana@exemplo.com', 'unsubscribe_all', T0)
    await repo.add('ana@exemplo.com', 'complaint', T0)
    expect(await repo.find('ana@exemplo.com')).toBe('complaint')

    await repo.add('ana@exemplo.com', 'bounce', T0)
    expect(await repo.find('ana@exemplo.com')).toBe('bounce')

    await repo.add('ana@exemplo.com', 'complaint', T0)
    await repo.add('ana@exemplo.com', 'unsubscribe_all', T0)
    await repo.add('ana@exemplo.com', 'bounce', T0)
    expect(await repo.find('ana@exemplo.com')).toBe('bounce')
    expect(await db.select().from(schema.emailSuppressions)).toHaveLength(1)
  })

  describe('preferências, destinatário e apagamento (EM.6.1)', () => {
    const createUser = async (
      suffix: string,
      extra: Partial<typeof schema.users.$inferInsert> = {},
    ) => {
      const [user] = await db
        .insert(schema.users)
        .values({
          name: `Ana ${suffix}`,
          email: `em61-${suffix}@exemplo.com`,
          username: `em61_${suffix}`,
          ...extra,
        })
        .onConflictDoUpdate({
          target: schema.users.email,
          set: { status: 'active', emailVerifiedAt: null, ...extra },
        })
        .returning()
      return user
    }

    it('sem linha, tudo desligado; update é upsert parcial e devolve o estado final', async () => {
      const repo = createDrizzleEmailPreferencesRepository(db)
      const user = await createUser('prefs')

      expect(await repo.get(user.id)).toEqual({ social: false, engagement: false })

      expect(await repo.update(user.id, { engagement: true }, T0)).toEqual({
        social: false,
        engagement: true,
      })
      expect(await repo.update(user.id, { social: true }, T0)).toEqual({
        social: true,
        engagement: true,
      })
      expect(await repo.update(user.id, { engagement: false }, T0)).toEqual({
        social: true,
        engagement: false,
      })
      expect(await repo.get(user.id)).toEqual({ social: true, engagement: false })
      expect(
        await db
          .select()
          .from(schema.emailPreferences)
          .where(eq(schema.emailPreferences.userId, user.id)),
      ).toHaveLength(1)

      await repo.deleteForUser(user.id)
      expect(await repo.get(user.id)).toEqual({ social: false, engagement: false })
    })

    it('o diretório de destinatários lê status e verificação do usuário', async () => {
      const directory = createDrizzleRecipientDirectory(db)
      const active = await createUser('dir-ativo', { emailVerifiedAt: T0 })
      const suspended = await createUser('dir-susp', { status: 'suspended' })

      expect(await directory.find(active.id)).toEqual({
        address: 'em61-dir-ativo@exemplo.com',
        name: 'Ana dir-ativo',
        status: 'active',
        emailVerified: true,
      })
      expect(await directory.find(suspended.id)).toMatchObject({
        status: 'suspended',
        emailVerified: false,
      })
      expect(await directory.find('00000000-0000-4000-8000-000000000000')).toBeNull()
    })

    it('deleteByUser apaga as linhas do usuário e preserva os templates mantidos e as dos outros', async () => {
      const repo = createDrizzleEmailOutboxRepository(db)
      const ana = await createUser('del-ana')
      const bia = await createUser('del-bia')
      await repo.enqueue({ ...base('a1'), userId: ana.id, templateKey: 'welcome' })
      await repo.enqueue({ ...base('a2'), userId: ana.id, templateKey: 'account_deleted' })
      await repo.enqueue({ ...base('b1'), userId: bia.id, templateKey: 'welcome' })
      await repo.enqueue(base('sem-usuario'))

      const deleted = await repo.deleteByUser(ana.id, { keepTemplateKeys: ['account_deleted'] })

      expect(deleted).toBe(1)
      const keys = (await db.select().from(schema.emailOutbox)).map((r) => r.idempotencyKey).sort()
      expect(keys).toEqual(['a2', 'b1', 'sem-usuario'])
    })
  })

  it('scrubClosedBefore zera endereço e payload só do que fechou antes do corte', async () => {
    const repo = createDrizzleEmailOutboxRepository(db)
    const old = new Date('2026-08-01T00:00:00Z')
    const cutoff = new Date('2026-09-10T00:00:00Z')
    const oldSent = await repo.enqueue(base('old-sent'))
    const oldFailed = await repo.enqueue(base('old-failed'))
    const recent = await repo.enqueue(base('recent'))
    const open = await repo.enqueue(base('open'))
    await db
      .update(schema.emailOutbox)
      .set({ status: 'sent', sentAt: old })
      .where(eq(schema.emailOutbox.id, oldSent.id))
    await db
      .update(schema.emailOutbox)
      .set({ status: 'failed', createdAt: old })
      .where(eq(schema.emailOutbox.id, oldFailed.id))
    await db
      .update(schema.emailOutbox)
      .set({ status: 'sent', sentAt: new Date('2026-10-01T00:00:00Z') })
      .where(eq(schema.emailOutbox.id, recent.id))
    await db
      .update(schema.emailOutbox)
      .set({ createdAt: old })
      .where(eq(schema.emailOutbox.id, open.id))

    expect(await repo.scrubClosedBefore(cutoff)).toBe(2)
    expect(await repo.scrubClosedBefore(cutoff)).toBe(0)

    const rows = Object.fromEntries(
      (await db.select().from(schema.emailOutbox)).map((r) => [r.id, r]),
    )
    expect(rows[oldSent.id]).toMatchObject({ toAddress: '', payload: {}, status: 'sent' })
    expect(rows[oldFailed.id]).toMatchObject({ toAddress: '', payload: {}, status: 'failed' })
    expect(rows[recent.id].toAddress).toBe('ana@exemplo.com')
    expect(rows[open.id].toAddress).toBe('ana@exemplo.com')
  })

  it('o leitor de saúde conta só pendente vencida e falha das últimas 24 h', async () => {
    const repo = createDrizzleEmailOutboxRepository(db)
    const reader = createDrizzleEmailOutboxHealthReader(db)
    const now = new Date('2026-10-10T12:00:00Z')
    await repo.enqueue({ ...base('due-old'), sendAt: new Date('2026-10-10T11:40:00Z') })
    await repo.enqueue({ ...base('due-new'), sendAt: new Date('2026-10-10T11:58:00Z') })
    await repo.enqueue({ ...base('future'), sendAt: new Date('2026-10-10T15:00:00Z') })
    const recentFail = await repo.enqueue(base('fail-recent'))
    const oldFail = await repo.enqueue(base('fail-old'))
    await db
      .update(schema.emailOutbox)
      .set({ status: 'failed', createdAt: new Date('2026-10-10T08:00:00Z') })
      .where(eq(schema.emailOutbox.id, recentFail.id))
    await db
      .update(schema.emailOutbox)
      .set({ status: 'failed', createdAt: new Date('2026-10-01T08:00:00Z') })
      .where(eq(schema.emailOutbox.id, oldFail.id))
    // As duas de `base` com sendAt 11:00 estão pendentes e vencidas até virarem failed acima.

    expect(await reader.read(now)).toEqual({
      pending: 2,
      failedLast24h: 1,
      oldestPendingAgeMs: 20 * 60_000,
    })
  })

  describe('audiência do resumo semanal (EM.7.1)', () => {
    const NOW = new Date('2026-10-12T13:00:00Z')
    const create = async (
      suffix: string,
      extra: Partial<typeof schema.users.$inferInsert> = {},
      engagement = true,
    ) => {
      const [user] = await db
        .insert(schema.users)
        .values({
          name: `Bia ${suffix}`,
          email: `em71-${suffix}@exemplo.com`,
          username: `em71_${suffix}`,
          emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
          ...extra,
        })
        .onConflictDoUpdate({
          target: schema.users.email,
          set: { status: 'active', emailVerifiedAt: new Date('2026-01-01T00:00:00Z'), ...extra },
        })
        .returning()
      await db
        .insert(schema.emailPreferences)
        .values({ userId: user.id, engagement })
        .onConflictDoUpdate({ target: schema.emailPreferences.userId, set: { engagement } })
      return user
    }

    it('lista só quem pode e quer receber, com nível, rentabilidade da semana e missão pendente', async () => {
      await db.delete(schema.userMissionProgress)
      await db.delete(schema.dailyMissions)
      await db.delete(schema.rankingSnapshots)
      const ok = await create('ok')
      const noOptIn = await create('noopt', {}, false)
      const suspended = await create('susp', { status: 'suspended' })
      const unverified = await create('unver', { emailVerifiedAt: null })
      const anonymized = await create('anon', { email: 'em71-anon@anonimo.invalid' })
      await db
        .insert(schema.userProgression)
        .values({ userId: ok.id, level: 7 })
        .onConflictDoUpdate({ target: schema.userProgression.userId, set: { level: 7 } })

      const [big, small] = await db
        .insert(schema.dailyMissions)
        .values([
          { key: 'em71_big', title: 'Missão grande', completionCriteria: 'x', xpReward: 50 },
          { key: 'em71_small', title: 'Missão pequena', completionCriteria: 'x', xpReward: 10 },
        ])
        .returning()
      await db.insert(schema.userMissionProgress).values({
        userId: ok.id,
        missionId: big.id,
        missionDate: '2026-10-12',
        status: 'completed',
      })
      const runId = '11111111-1111-4111-8111-111111111111'
      await db.insert(schema.rankingSnapshots).values([
        {
          runId,
          computedAt: NOW,
          windowKind: 'week',
          criterion: 'overall',
          userId: ok.id,
          position: 1,
          username: 'em71_ok',
          level: 7,
          xp: 0,
          profitabilityPct: 2.5,
          sortKey: 2.5,
        },
        {
          runId,
          computedAt: NOW,
          windowKind: 'month',
          criterion: 'overall',
          userId: ok.id,
          position: 1,
          username: 'em71_ok',
          level: 7,
          xp: 0,
          profitabilityPct: 9,
          sortKey: 9,
        },
      ])

      const page = await createDrizzleWeeklyDigestAudience(db, () => NOW).listPage(null, 100)
      const mine = page.filter((c) => c.address.startsWith('em71-'))

      expect(mine.map((c) => c.userId)).toEqual([ok.id])
      expect([noOptIn, suspended, unverified, anonymized].map((u) => u.id)).not.toContain(
        mine[0]?.userId,
      )
      expect(mine[0]).toMatchObject({
        level: 7,
        weeklyReturnPct: 2.5,
        pendingMissions: 1,
        pendingMissionTitle: small.title,
      })
      expect(Object.keys(mine[0]).sort()).toEqual(
        [
          'address',
          'level',
          'name',
          'pendingMissionTitle',
          'pendingMissions',
          'userId',
          'weeklyReturnPct',
        ].sort(),
      )
    })

    it('pagina por cursor de userId, sem repetir nem pular ninguém', async () => {
      const users = await Promise.all([create('p1'), create('p2'), create('p3')])
      const audience = createDrizzleWeeklyDigestAudience(db, () => NOW)

      const first = await audience.listPage(null, 2)
      const second = await audience.listPage(first[first.length - 1].userId, 2)
      const ids = [...first, ...second]
        .map((c) => c.userId)
        .filter((id) => users.some((u) => u.id === id))

      expect(new Set(ids).size).toBe(ids.length)
      expect(ids.sort()).toEqual(users.map((u) => u.id).sort())
    })
  })

  it('raridade da conquista (EM.7.2) conta só jogador ativo e não anonimizado', async () => {
    await db.delete(schema.userAchievements)
    const mk = async (suffix: string, extra: Partial<typeof schema.users.$inferInsert> = {}) => {
      const [u] = await db
        .insert(schema.users)
        .values({
          name: suffix,
          email: `em72-${suffix}@exemplo.com`,
          username: `em72_${suffix}`,
          ...extra,
        })
        .onConflictDoUpdate({
          target: schema.users.email,
          set: { role: 'user', status: 'active', ...extra },
        })
        .returning()
      return u
    }
    const a = await mk('a')
    const b = await mk('b')
    const suspended = await mk('susp', { status: 'suspended' })
    const admin = await mk('adm', { role: 'admin' })
    const anon = await mk('anon', { email: 'em72-anon@anonimo.invalid' })
    const [ach] = await db
      .insert(schema.achievements)
      .values({
        name: 'em72',
        criteriaType: 'trades_executed',
        criteriaValue: 1,
      })
      .returning()
    await db
      .insert(schema.userAchievements)
      .values([a, suspended, admin, anon].map((u) => ({ userId: u.id, achievementId: ach.id })))

    const rarity = await createDrizzleAchievementRarityReader(db).getRarity(ach.id)
    const players = await db
      .select()
      .from(schema.users)
      .then((rows) =>
        rows.filter(
          (u) => u.role === 'user' && u.status === 'active' && !u.email.endsWith('.invalid'),
        ),
      )

    expect(rarity.holders).toBe(1)
    expect(rarity.population).toBe(players.length)
    expect(players.map((u) => u.id)).toContain(b.id)
  })

  describe('audiência do lembrete de sequência (EM.7.3)', () => {
    const mk = async (
      suffix: string,
      progression: { streak: number; last: string | null },
      user: Partial<typeof schema.users.$inferInsert> = {},
      engagement = true,
    ) => {
      const [u] = await db
        .insert(schema.users)
        .values({
          name: suffix,
          email: `em73-${suffix}@exemplo.com`,
          username: `em73_${suffix}`,
          emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
          ...user,
        })
        .onConflictDoUpdate({
          target: schema.users.email,
          set: { status: 'active', emailVerifiedAt: new Date('2026-01-01T00:00:00Z'), ...user },
        })
        .returning()
      await db
        .insert(schema.emailPreferences)
        .values({ userId: u.id, engagement })
        .onConflictDoUpdate({ target: schema.emailPreferences.userId, set: { engagement } })
      await db
        .insert(schema.userProgression)
        .values({
          userId: u.id,
          currentStreak: progression.streak,
          lastQualifyingActivityDate: progression.last,
        })
        .onConflictDoUpdate({
          target: schema.userProgression.userId,
          set: { currentStreak: progression.streak, lastQualifyingActivityDate: progression.last },
        })
      return u
    }

    it('traz só quem fez a última atividade ontem, com sequência mínima e pode receber', async () => {
      const ok = await mk('ok', { streak: 5, last: '2026-10-11' })
      await mk('hoje', { streak: 5, last: '2026-10-12' })
      await mk('antes', { streak: 5, last: '2026-10-09' })
      await mk('curta', { streak: 2, last: '2026-10-11' })
      await mk('susp', { streak: 5, last: '2026-10-11' }, { status: 'suspended' })
      await mk('noopt', { streak: 5, last: '2026-10-11' }, {}, false)
      await mk('unver', { streak: 5, last: '2026-10-11' }, { emailVerifiedAt: null })

      const page = await createDrizzleStreakReminderAudience(db).listPage(null, 100, {
        lastActivityDay: '2026-10-11',
        minStreak: 3,
      })
      const mine = page.filter((c) => c.address.startsWith('em73-'))

      expect(mine).toEqual([
        { userId: ok.id, address: 'em73-ok@exemplo.com', name: 'ok', currentStreak: 5 },
      ])
    })
  })
})
