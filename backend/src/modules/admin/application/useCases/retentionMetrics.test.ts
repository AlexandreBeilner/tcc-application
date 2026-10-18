import { beforeAll, describe, expect, it } from 'vitest'
import { addDays, weekStart } from '../../domain/retention'
import { createInMemoryRetentionReader } from '../../test/fakes/inMemoryRetentionReader'
import { buildSyntheticRetention } from '../../test/retentionDataset'
import { GetActiveUsersUseCase } from './getActiveUsers'
import { GetMilestoneTimesUseCase } from './getMilestoneTimes'
import { GetRetentionCohortsUseCase } from './getRetentionCohorts'

// Dados sintéticos de tamanho realista: 5 mil pessoas cadastradas ao longo de ~7 meses, presença
// registrada só a partir de 2026-06-01 e atividade a partir de 2026-05-01 (como no banco real, onde
// `daily_activity` é mais antiga que `daily_presence`), mais administradores que nunca devem contar.
const TODAY = '2026-10-18'
const NOW = new Date(`${TODAY}T15:30:00Z`)
const PRESENCE_SINCE = '2026-06-01'
const ACTIVITY_SINCE = '2026-05-01'

describe('métricas de retenção (5 mil pessoas, 7 meses)', () => {
  const data = buildSyntheticRetention({
    users: 5000,
    admins: 40,
    today: TODAY,
    firstSignupDay: '2026-03-02',
    presenceSince: PRESENCE_SINCE,
    activitySince: ACTIVITY_SINCE,
  })
  const reader = createInMemoryRetentionReader(data)
  const people = data.users.filter((u) => u.role === 'user')

  describe('coortes semanais', () => {
    let result: Awaited<ReturnType<GetRetentionCohortsUseCase['execute']>>
    beforeAll(async () => {
      result = await new GetRetentionCohortsUseCase(reader, () => NOW).execute({ weeks: 52 })
    })

    it('devolve as coortes da mais recente para a mais antiga, sem administradores', () => {
      const weeks = result.cohorts.map((c) => c.cohort_week)
      expect([...weeks].sort().reverse()).toEqual(weeks)
      expect(weeks[0]).toBe(weekStart(TODAY))
      expect(result.cohorts.reduce((sum, c) => sum + c.size, 0)).toBe(people.length)
      expect(result.tracking_since).toEqual({ presence: PRESENCE_SINCE, activity: ACTIVITY_SINCE })
    })

    it('coorte que ainda não chegou ao dia 30 aparece em andamento, nunca zero', () => {
      const newest = result.cohorts[0]
      expect(newest.returned.d30).toMatchObject({ status: 'in_progress', rate: null, measured: 0 })
      expect(newest.studied.d30).toMatchObject({ status: 'in_progress', rate: null })
      // Toda coorte com dia 30 ainda por vir tem a célula em andamento ou parcial, jamais "0%".
      for (const cohort of result.cohorts.slice(0, 5)) {
        const cell = cohort.returned.d30
        if (cell.rate === 0) expect(cell.measured).toBeGreaterThan(0)
      }
    })

    it('coorte anterior ao registro de presença é sem dado em "voltou", mas tem dado em "estudou"', () => {
      const old = result.cohorts.find((c) => c.cohort_week === '2026-03-09')
      expect(old).toBeDefined()
      expect(old?.returned.d1).toMatchObject({ status: 'no_data', rate: null })
      expect(old?.returned.d30).toMatchObject({ status: 'no_data', rate: null })
      // A atividade começa em 2026-05-01: o dia 30 dessa coorte (abril) ainda é anterior a ela.
      expect(old?.studied.d30).toMatchObject({ status: 'no_data' })
      // Uma coorte de maio já tem atividade medida, mas ainda não tinha registro de presença.
      const may = result.cohorts.find((c) => c.cohort_week === '2026-05-11')
      expect(may?.studied.d7).toMatchObject({ status: 'complete' })
      expect(may?.returned.d7).toMatchObject({ status: 'no_data' })
      // Depois das duas datas de início, as duas medidas existem.
      const july = result.cohorts.find((c) => c.cohort_week === '2026-07-06')
      expect(july?.studied.d7).toMatchObject({ status: 'complete' })
      expect(july?.returned.d7).toMatchObject({ status: 'complete' })
    })

    it('a taxa de uma coorte completa confere com a contagem direta dos dados', () => {
      const week = '2026-07-06'
      const cohort = result.cohorts.find((c) => c.cohort_week === week)
      expect(cohort).toBeDefined()
      const members = people.filter(
        (u) => weekStart(u.createdAt.toISOString().slice(0, 10)) === week,
      )
      const back = (offset: number) =>
        members.filter((u) =>
          data.presence.has(`${u.id}|${addDays(u.createdAt.toISOString().slice(0, 10), offset)}`),
        ).length
      expect(cohort?.size).toBe(members.length)
      expect(members.length).toBeGreaterThan(50)
      expect(cohort?.returned.d1.rate).toBeCloseTo(back(1) / members.length, 10)
      expect(cohort?.returned.d7.rate).toBeCloseTo(back(7) / members.length, 10)
      expect(cohort?.returned.d30.rate).toBeCloseTo(back(30) / members.length, 10)
    })

    it('a retenção média cai do dia 1 para o 7 e o 30 e toda taxa fica entre 0 e 1', () => {
      const complete = result.cohorts.filter((c) =>
        [c.returned.d1, c.returned.d7, c.returned.d30, c.studied.d1].every(
          (cell) => cell.status === 'complete',
        ),
      )
      expect(complete.length).toBeGreaterThan(5)
      const mean = (pick: (c: (typeof complete)[number]) => number | null) =>
        complete.reduce((sum, c) => sum + (pick(c) as number), 0) / complete.length
      expect(mean((c) => c.returned.d1.rate)).toBeGreaterThan(mean((c) => c.returned.d7.rate))
      expect(mean((c) => c.returned.d7.rate)).toBeGreaterThan(mean((c) => c.returned.d30.rate))
      for (const c of complete) {
        for (const cell of [c.returned.d1, c.returned.d7, c.returned.d30, c.studied.d1]) {
          expect(cell.rate).toBeGreaterThanOrEqual(0)
          expect(cell.rate).toBeLessThanOrEqual(1)
        }
        // "Estudou" é subconjunto de "voltou" nos dados sintéticos.
        expect(c.studied.d1.rate as number).toBeLessThanOrEqual(c.returned.d1.rate as number)
      }
    })

    it('respeita o número de semanas pedido', async () => {
      const short = await new GetRetentionCohortsUseCase(reader, () => NOW).execute({ weeks: 4 })
      expect(short.cohorts).toHaveLength(4)
      expect(short.cohorts[3].cohort_week).toBe(addDays(weekStart(TODAY), -21))
    })

    it('sem nenhum registro de presença, tudo é sem dado ou em andamento', async () => {
      const empty = createInMemoryRetentionReader({ ...data, presence: new Set() })
      const out = await new GetRetentionCohortsUseCase(empty, () => NOW).execute({ weeks: 52 })
      expect(out.tracking_since.presence).toBeNull()
      for (const cohort of out.cohorts) {
        expect(['no_data', 'in_progress']).toContain(cohort.returned.d7.status)
        expect(cohort.returned.d7.rate).toBeNull()
      }
    })
  })

  describe('ativos por dia, DAU e MAU', () => {
    let result: Awaited<ReturnType<GetActiveUsersUseCase['execute']>>
    beforeAll(async () => {
      result = await new GetActiveUsersUseCase(reader, () => NOW).execute({ days: 180 })
    })

    it('termina ontem, em ordem, e não inclui o dia que ainda não fechou', () => {
      expect(result.days).toHaveLength(180)
      expect(result.days.at(-1)?.day).toBe(addDays(TODAY, -1))
      expect(result.days[0].day).toBe(addDays(TODAY, -180))
    })

    it('dias antes do registro são nulos (sem dado), não zero', () => {
      const beforePresence = result.days.find((d) => d.day === '2026-05-20')
      expect(beforePresence).toMatchObject({ returned: null, mau: null, dau_mau: null })
      expect(beforePresence?.studied).not.toBeNull() // atividade já era registrada
      const beforeActivity = result.days.find((d) => d.day === '2026-04-25')
      expect(beforeActivity?.studied).toBeNull()
    })

    it('o MAU só aparece quando os 30 dias da janela estão dentro do registro', () => {
      expect(result.days.find((d) => d.day === '2026-06-29')?.mau).toBeNull()
      expect(result.days.find((d) => d.day === '2026-06-30')?.mau).toBeGreaterThan(0)
    })

    it('DAU/MAU é a razão entre os dois e fica entre 0 e 1', () => {
      const tracked = result.days.filter((d) => d.mau !== null && d.returned !== null)
      expect(tracked.length).toBeGreaterThan(100)
      for (const d of tracked) {
        expect(d.dau_mau).toBeCloseTo((d.returned as number) / (d.mau as number), 10)
        expect(d.dau_mau).toBeGreaterThan(0)
        expect(d.dau_mau).toBeLessThanOrEqual(1)
        expect(d.mau as number).toBeGreaterThanOrEqual(d.returned as number)
      }
    })

    it('o DAU de um dia confere com a contagem direta (sem administradores)', () => {
      const day = '2026-10-10'
      const direct = people.filter((u) => data.presence.has(`${u.id}|${day}`)).length
      expect(result.days.find((d) => d.day === day)?.returned).toBe(direct)
    })
  })

  describe('marcos', () => {
    let result: Awaited<ReturnType<GetMilestoneTimesUseCase['execute']>>
    beforeAll(async () => {
      result = await new GetMilestoneTimesUseCase(reader, () => NOW).execute({ weeks: 52 })
    })

    it('só conta quem se cadastrou depois do início do registro', () => {
      expect(result.tracking_since).toBe(addDays(PRESENCE_SINCE, 1))
      const expected = people.filter(
        (u) => u.createdAt.toISOString().slice(0, 10) >= addDays(PRESENCE_SINCE, 1),
      ).length
      expect(result.eligible).toBe(expected)
      expect(result.cohorts.reduce((sum, c) => sum + c.size, 0)).toBe(expected)
      expect(Math.min(...result.cohorts.map((c) => c.cohort_week.length))).toBe(10)
      expect(
        result.cohorts.every((c) => c.cohort_week >= weekStart(addDays(PRESENCE_SINCE, 1))),
      ).toBe(true)
    })

    it('devolve os cinco marcos, com mediana e fração dos elegíveis que chegaram', () => {
      expect(result.milestones.map((m) => m.milestone)).toEqual([
        'first_return',
        'first_lesson',
        'first_trade',
        'first_fixed_income',
        'first_daily',
      ])
      const lesson = result.milestones.find((m) => m.milestone === 'first_lesson')
      // Os dados dão a 70% e atraso uniforme de 0 a 48 h: mediana perto de 24 h.
      expect(lesson?.reached_rate).toBeGreaterThan(0.65)
      expect(lesson?.reached_rate).toBeLessThan(0.75)
      expect(lesson?.median_seconds).toBeGreaterThan(20 * 3600)
      expect(lesson?.median_seconds).toBeLessThan(28 * 3600)
      const fixed = result.milestones.find((m) => m.milestone === 'first_fixed_income')
      expect(fixed?.reached_rate).toBeLessThan(lesson?.reached_rate as number)
      const back = result.milestones.find((m) => m.milestone === 'first_return')
      expect(back?.granularity).toBe('day')
      expect((back?.median_seconds as number) % 86_400).toBe(0)
    })

    it('coortes com menos de 30 dias depois do fim da semana ainda estão em andamento', () => {
      const newest = result.cohorts[0]
      expect(newest.status).toBe('in_progress')
      const oldest = result.cohorts.at(-1)
      expect(oldest?.status).toBe('complete')
      for (const c of result.cohorts) {
        for (const rate of Object.values(c.rates)) {
          expect(rate).toBeGreaterThanOrEqual(0)
          expect(rate).toBeLessThanOrEqual(1)
        }
      }
    })

    it('sem registro nenhum, não há elegíveis nem mediana', async () => {
      const empty = createInMemoryRetentionReader({ ...data, presence: new Set() })
      const out = await new GetMilestoneTimesUseCase(empty, () => NOW).execute()
      expect(out.eligible).toBe(0)
      expect(out.tracking_since).toBeNull()
      expect(
        out.milestones.every((m) => m.median_seconds === null && m.reached_rate === null),
      ).toBe(true)
    })
  })
})
