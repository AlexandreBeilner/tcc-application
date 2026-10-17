import { describe, expect, it } from 'vitest'
import { ADMIN, buildAdminWorld, reviewAll } from '../../../test/adminWorld'
import { DailyAdminConflictError, DailyAdminInvalidError } from '../../../domain/errors'

const TODAY = '2026-10-20T12:00:00Z'
const START = '2026-11-10'

describe('PrepareLaunchDraftUseCase', () => {
  it('materializa o rascunho de 30 dias a partir da data, sem gravar a estreia', async () => {
    const w = buildAdminWorld({ startDate: null, now: TODAY })
    const result = await w.prepareDraft.execute(START)
    expect(result.created).toBe(30)
    expect(w.settings.state.startDate).toBeNull()
    expect(w.puzzles.items[0]).toMatchObject({ number: 1, gameDate: START, publishedAt: null })
  })

  it('recusa data que não é futura e data malformada', async () => {
    const w = buildAdminWorld({ startDate: null, now: TODAY })
    await expect(w.prepareDraft.execute('2026-10-20')).rejects.toMatchObject({
      code: 'not_in_future',
    })
    await expect(w.prepareDraft.execute('2026-13-40')).rejects.toBeInstanceOf(
      DailyAdminInvalidError,
    )
  })

  it('recusa com o Diário no ar', async () => {
    const w = buildAdminWorld({ startDate: '2026-10-01', now: TODAY })
    await expect(w.prepareDraft.execute(START)).rejects.toMatchObject({ code: 'already_started' })
  })
})

describe('SetStartDateUseCase', () => {
  it('recusa agendar sem 30 dias revisados à frente', async () => {
    const w = buildAdminWorld({ startDate: null, now: TODAY })
    await w.prepareDraft.execute(START)
    await expect(w.setStartDate.execute(ADMIN, START)).rejects.toMatchObject({
      code: 'insufficient_content',
    })
    expect(w.settings.state.startDate).toBeNull()
  })

  it('29 dias revisados ainda não bastam; o buraco encerra a contagem', async () => {
    const w = buildAdminWorld({ startDate: null, now: TODAY })
    await w.prepareDraft.execute(START)
    await reviewAll(w)
    const middle = w.puzzles.items.find((p) => p.number === 15)!
    middle.reviewedAt = null
    await expect(w.setStartDate.execute(ADMIN, START)).rejects.toMatchObject({
      code: 'insufficient_content',
    })
  })

  it('agenda com 30 dias revisados e publica os revisados em lote', async () => {
    const w = buildAdminWorld({ startDate: null, now: TODAY })
    await w.prepareDraft.execute(START)
    await reviewAll(w)
    const result = await w.setStartDate.execute(ADMIN, START)
    expect(result.status).toBe('scheduled')
    expect(result.published).toHaveLength(30)
    expect(w.settings.state.startDate).toBe(START)
    expect(w.puzzles.items.every((p) => p.publishedAt !== null)).toBe(true)
  })

  it('recusa data que não é futura', async () => {
    const w = buildAdminWorld({ startDate: null, now: TODAY })
    await expect(w.setStartDate.execute(ADMIN, '2026-10-20')).rejects.toMatchObject({
      code: 'not_in_future',
    })
  })

  it('muda a data enquanto futura: renumera e mantém as revisões', async () => {
    const w = buildAdminWorld({ startDate: null, now: TODAY })
    await w.prepareDraft.execute(START)
    await reviewAll(w)
    await w.setStartDate.execute(ADMIN, START)

    // Dois dias antes: precisa de rascunho e revisão dos dias novos.
    const earlier = '2026-11-08'
    await w.prepareDraft.execute(earlier)
    await reviewAll(w)
    const result = await w.setStartDate.execute(ADMIN, earlier)
    expect(result.status).toBe('scheduled')
    expect(w.settings.state.startDate).toBe(earlier)
    const first = w.puzzles.items.find((p) => p.gameDate === earlier)!
    expect(first.number).toBe(1)
    expect(w.puzzles.items.find((p) => p.gameDate === START)!.number).toBe(3)
    expect(w.puzzles.items.every((p) => p.publishedAt !== null)).toBe(true)
  })

  it('desliga enquanto agendado e tira tudo do ar', async () => {
    const w = buildAdminWorld({ startDate: null, now: TODAY })
    await w.prepareDraft.execute(START)
    await reviewAll(w)
    await w.setStartDate.execute(ADMIN, START)
    const result = await w.setStartDate.execute(ADMIN, null)
    expect(result).toEqual({ startDate: null, status: 'off', published: [] })
    expect(w.puzzles.items.every((p) => p.publishedAt === null)).toBe(true)
  })

  it('depois do início a data não muda mais, nem desliga', async () => {
    const w = buildAdminWorld({ startDate: '2026-10-01', now: TODAY })
    await expect(w.setStartDate.execute(ADMIN, '2026-12-01')).rejects.toBeInstanceOf(
      DailyAdminConflictError,
    )
    await expect(w.setStartDate.execute(ADMIN, null)).rejects.toMatchObject({
      code: 'already_started',
    })
    expect(w.settings.state.startDate).toBe('2026-10-01')
  })
})
