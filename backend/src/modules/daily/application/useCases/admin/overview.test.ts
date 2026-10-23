import { describe, expect, it } from 'vitest'
import { ADMIN, buildAdminWorld } from '../../../test/adminWorld'

const TODAY = '2026-10-20T12:00:00Z'
const START = '2026-11-10'

describe('GetDailyAdminOverviewUseCase', () => {
  it('desligado e sem rascunho: agenda vazia e sem alertas', async () => {
    const w = buildAdminWorld({ startDate: null, now: TODAY })
    const o = await w.overview.execute()
    expect(o).toMatchObject({
      status: 'off',
      startDate: null,
      canChangeStart: true,
      days: [],
      alerts: [],
      readyDaysAhead: 0,
    })
    expect(o.bank).toEqual({ words: 60, questions: 60, acceptedExtra: 1 })
  })

  it('rascunho: conta os dias prontos seguidos e a cobertura por categoria e marcador', async () => {
    const w = buildAdminWorld({ startDate: null, now: TODAY })
    await w.prepareDraft.execute(START)
    const o = await w.overview.execute()
    expect(o.agendaFrom).toBe(START)
    expect(o.readyDaysAhead).toBe(30)
    expect(o.days).toHaveLength(30)
    expect(o.coverage.windowDays).toBe(30)
    expect(o.coverage.word.total).toBe(30)
    expect(o.coverage.word.brasil + o.coverage.word.fora).toBe(30)
    expect(Object.values(o.coverage.trivia.byCategory).reduce((a, b) => a + b, 0)).toBe(30)
  })

  it('agendado com menos de 30 dias prontos alerta; com menos de 14 também', async () => {
    const w = buildAdminWorld({ startDate: null, now: TODAY })
    await w.prepareDraft.execute(START)
    await w.setStartDate.execute(ADMIN, START)
    expect((await w.overview.execute()).alerts).toEqual([])

    // Um dia some da agenda depois de agendado: a contagem seguida para nele.
    w.puzzles.items.splice(
      w.puzzles.items.findIndex((p) => p.number === 10),
      1,
    )
    const o = await w.overview.execute()
    expect(o.readyDaysAhead).toBe(9)
    expect(o.alerts).toEqual(['low_ready_cover', 'scheduled_below_minimum'])
  })

  it('no ar: alerta se o jogo de hoje não está publicado, e não deixa mudar a estreia', async () => {
    const w = buildAdminWorld({ startDate: '2026-10-19', now: TODAY })
    await w.materialize.execute()
    let o = await w.overview.execute()
    expect(o).toMatchObject({ status: 'live', canChangeStart: false, agendaFrom: '2026-10-20' })
    expect(o.alerts).not.toContain('today_not_published')

    w.puzzles.items.forEach((p) => (p.publishedAt = null))
    o = await w.overview.execute()
    expect(o.alerts).toContain('today_not_published')

    await w.publishPuzzles.execute()
    o = await w.overview.execute()
    expect(o.alerts).not.toContain('today_not_published')
    expect(o.publishedDaysAhead).toBe(30)
  })

  it('no ar sem o jogo de hoje materializado também alerta', async () => {
    const w = buildAdminWorld({ startDate: '2026-10-19', now: TODAY })
    expect((await w.overview.execute()).alerts).toContain('today_not_published')
  })
})
