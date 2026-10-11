import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Assembly, AgendaOption } from '../../domain/assembly'
import { createEngineCompanyReportSource } from './engineCompanyReportSource'
import { createEngineHoldingsSnapshotProvider } from './engineHoldingsSnapshotProvider'
import { createEngineShareholderEffect, parseEngineEffect } from './engineShareholderEffect'

const URL = 'http://engine:8080'
const assembly = { id: 'a-1', subjectRef: 'c-1' } as Assembly

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status }))
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => vi.unstubAllGlobals())

describe('engineHoldingsSnapshotProvider', () => {
  const body = { taken_at: '2026-10-10T12:00:00Z', holdings: [{ user_id: 'u1', quantity: 30 }] }

  it('take: POST com assembleia e empresa, traduz para o domínio', async () => {
    const fetchFn = mockFetch(201, body)
    const snap = await createEngineHoldingsSnapshotProvider(URL).take(assembly)
    expect(fetchFn).toHaveBeenCalledWith(
      `${URL}/governance/snapshots`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ assembly_id: 'a-1', company_id: 'c-1' }),
      }),
    )
    expect(snap).toEqual({
      takenAt: new Date('2026-10-10T12:00:00Z'),
      holdings: [{ userId: 'u1', quantity: 30 }],
    })
  })

  it('get: lê o snapshot já tirado e propaga o erro do motor', async () => {
    const fetchFn = mockFetch(200, body)
    await createEngineHoldingsSnapshotProvider(URL).get(assembly)
    expect(fetchFn).toHaveBeenCalledWith(`${URL}/governance/snapshots/a-1`, undefined)
    mockFetch(404, { error: 'sem snapshot' })
    await expect(createEngineHoldingsSnapshotProvider(URL).get(assembly)).rejects.toThrow(
      'sem snapshot',
    )
  })
})

describe('engineCompanyReportSource', () => {
  it('pede a janela de dias e traduz o payload', async () => {
    const fetchFn = mockFetch(200, {
      simulated_day: 93,
      reports: [
        {
          company_id: 'c-1',
          name: 'Acme',
          sector: 'Varejo',
          tickers: ['ACME3'],
          report_day: 91,
          days_since_report: 2,
        },
      ],
    })
    const reports = await createEngineCompanyReportSource(URL).listRecentReports(2, 9)
    expect(fetchFn).toHaveBeenCalledWith(
      `${URL}/governance/reports?min_days=2&max_days=9`,
      undefined,
    )
    expect(reports).toEqual([
      {
        companyId: 'c-1',
        name: 'Acme',
        sector: 'Varejo',
        tickers: ['ACME3'],
        reportDay: 91,
        daysSinceReport: 2,
      },
    ])
  })
})

describe('engineShareholderEffect', () => {
  const winner = (effect: Record<string, unknown>): AgendaOption => ({
    id: 'o-1',
    assemblyId: 'a-1',
    key: 'expandir',
    label: 'x',
    gain: 'g',
    loss: 'l',
    effect,
    position: 0,
  })
  const effect = { metric: 'base_growth_pct', direction: 1, intensity: 0.8 }

  it('envia a decisão aprovada sem valor absoluto', async () => {
    const fetchFn = mockFetch(201, {})
    await createEngineShareholderEffect(URL).apply(assembly, winner(effect))
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`${URL}/governance/decisions`)
    expect(JSON.parse(init.body as string)).toEqual({
      assembly_id: 'a-1',
      company_id: 'c-1',
      option_key: 'expandir',
      effect,
    })
  })

  it('pauta sem vencedor não chama o motor', async () => {
    const fetchFn = mockFetch(201, {})
    await createEngineShareholderEffect(URL).apply(assembly, null)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('efeito malformado falha antes de chamar o motor', async () => {
    const fetchFn = mockFetch(201, {})
    await expect(
      createEngineShareholderEffect(URL).apply(
        assembly,
        winner({ metric: 'preco', direction: 1, intensity: 1 }),
      ),
    ).rejects.toThrow('métrica')
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it.each([
    [{ metric: 'base_growth_pct', direction: 0, intensity: 0.5 }, 'direção'],
    [{ metric: 'base_growth_pct', direction: 1, intensity: 0 }, 'intensidade'],
    [{ metric: 'quality_multiplier', direction: -1, intensity: 1.5 }, 'intensidade'],
    [{ metric: 'quality_multiplier', direction: -1, intensity: '1' }, 'intensidade'],
  ])('parseEngineEffect rejeita %j', (raw, message) => {
    expect(() => parseEngineEffect(raw)).toThrow(message)
  })
})
