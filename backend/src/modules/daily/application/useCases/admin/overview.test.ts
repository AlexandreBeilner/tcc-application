import { describe, expect, it } from 'vitest'
import { ADMIN, buildAdminWorld, reviewAll } from '../../../test/adminWorld'

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
      reviewedDaysAhead: 0,
    })
    expect(o.bank).toMatchObject({ words: 60, questions: 60, events: 200, acceptedExtra: 1 })
  })

  it('rascunho: conta revisados seguidos e a cobertura por categoria e marcador', async () => {
    const w = buildAdminWorld({ startDate: null, now: TODAY })
    await w.prepareDraft.execute(START)
    for (let n = 1; n <= 5; n++) await w.reviewPuzzle.execute(ADMIN, n)
    const o = await w.overview.execute()
    expect(o.agendaFrom).toBe(START)
    expect(o.reviewedDaysAhead).toBe(5)
    expect(o.days).toHaveLength(30)
    expect(o.coverage.windowDays).toBe(30)
    expect(o.coverage.word.total).toBe(30)
    expect(o.coverage.word.brasil + o.coverage.word.fora).toBe(30)
    expect(o.coverage.timeline.total).toBe(120)
    expect(Object.values(o.coverage.trivia.byCategory).reduce((a, b) => a + b, 0)).toBe(30)
  })

  it('agendado com menos de 30 revisados alerta; com menos de 14 também', async () => {
    const w = buildAdminWorld({ startDate: null, now: TODAY })
    await w.prepareDraft.execute(START)
    await reviewAll(w)
    await w.setStartDate.execute(ADMIN, START)
    expect((await w.overview.execute()).alerts).toEqual([])

    // Um dia perde a revisão depois de agendado (troca de cartão confirmada, por exemplo).
    w.puzzles.items.find((p) => p.number === 10)!.reviewedAt = null
    const o = await w.overview.execute()
    expect(o.reviewedDaysAhead).toBe(9)
    expect(o.alerts).toEqual(['low_reviewed_cover', 'scheduled_below_minimum'])
  })

  it('no ar: alerta se o jogo de hoje não está publicado, e não deixa mudar a estreia', async () => {
    const w = buildAdminWorld({ startDate: '2026-10-19', now: TODAY })
    await w.materialize.execute()
    await reviewAll(w)
    let o = await w.overview.execute()
    expect(o).toMatchObject({ status: 'live', canChangeStart: false, agendaFrom: '2026-10-20' })
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
