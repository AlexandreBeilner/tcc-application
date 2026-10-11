import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Assembly, AgendaOption } from '../../domain/assembly'
import { GovernanceEngineUnavailableError } from '../../domain/errors'
import { createEngineCompanyStandingReader } from './engineCompanyStandingReader'
import { createEngineCompanyReportSource } from './engineCompanyReportSource'
import { createEngineHoldingsSnapshotProvider } from './engineHoldingsSnapshotProvider'
import { createEngineShareholderEffect, parseEngineEffects } from './engineShareholderEffect'
import { createEngineDeclarationSource } from './engineDeclarationSource'

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

describe('engineClient (motor fora do ar)', () => {
  it('rede caindo vira GovernanceEngineUnavailableError (a rota responde 503, não 500)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed')
      }),
    )
    await expect(createEngineHoldingsSnapshotProvider(URL).get(assembly)).rejects.toBeInstanceOf(
      GovernanceEngineUnavailableError,
    )
  })

  it('5xx do motor também; 4xx continua sendo o erro do motor, com a mensagem dele', async () => {
    mockFetch(502, { error: 'gateway' })
    await expect(createEngineHoldingsSnapshotProvider(URL).get(assembly)).rejects.toBeInstanceOf(
      GovernanceEngineUnavailableError,
    )
    mockFetch(422, { error: 'dado inválido' })
    await expect(createEngineHoldingsSnapshotProvider(URL).get(assembly)).rejects.toThrow(
      'dado inválido',
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
      effects: [effect],
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
    ).rejects.toThrow('alavanca')
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('envia os dois efeitos da opção, a política com o valor-alvo e o id da declaração retida', async () => {
    const fetchFn = mockFetch(201, {})
    const profit = {
      effects: [
        { metric: 'dividend_policy', value: 'semiannual' },
        { metric: 'payout_ratio_pct', direction: -1, intensity: 0.5 },
      ],
    }
    await createEngineShareholderEffect(URL).apply(
      { ...assembly, declarationId: 'decl-1' },
      winner(profit),
    )
    const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(init.body as string)).toEqual({
      assembly_id: 'a-1',
      company_id: 'c-1',
      option_key: 'expandir',
      declaration_id: 'decl-1',
      effects: profit.effects,
    })
  })

  it('sem declaração retida não manda declaration_id', async () => {
    const fetchFn = mockFetch(201, {})
    await createEngineShareholderEffect(URL).apply(assembly, winner(effect))
    const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(init.body as string)).not.toHaveProperty('declaration_id')
  })

  it.each([
    [{ metric: 'base_growth_pct', direction: 0, intensity: 0.5 }],
    [{ metric: 'base_growth_pct', direction: 1, intensity: 0 }],
    [{ metric: 'quality_multiplier', direction: -1, intensity: 1.5 }],
    [{ metric: 'quality_multiplier', direction: -1, intensity: '1' }],
    [{ effects: [] }],
    [{ metric: 'dividend_policy', value: 'mensal' }],
  ])('parseEngineEffects rejeita %j', (raw) => {
    expect(() => parseEngineEffects(raw)).toThrow('efeitos da opção inválidos')
  })

  it('lê o formato antigo e o novo', () => {
    expect(parseEngineEffects(effect)).toEqual([effect])
    expect(parseEngineEffects({ effects: [effect] })).toEqual([effect])
  })
})

describe('engineCompanyStandingReader', () => {
  it('pede a situação da empresa para a pessoa e traduz o payload', async () => {
    const fetchFn = mockFetch(200, {
      company_id: 'c-1',
      name: 'Acme',
      sector: 'Varejo',
      holds_shares: true,
      cooldown_days_left: 12,
    })
    const standing = await createEngineCompanyStandingReader(URL).get('c-1', 'u-1')
    expect(fetchFn).toHaveBeenCalledWith(
      `${URL}/governance/companies/c-1/standing?user_id=u-1`,
      undefined,
    )
    expect(standing).toEqual({
      companyId: 'c-1',
      name: 'Acme',
      sector: 'Varejo',
      holdsShares: true,
      cooldownDaysLeft: 12,
    })
  })

  it('empresa desconhecida vira null; outro erro do motor propaga', async () => {
    mockFetch(404, { error: 'empresa não encontrada' })
    expect(await createEngineCompanyStandingReader(URL).get('c-1', 'u-1')).toBeNull()
    mockFetch(503, { error: 'governança indisponível' })
    await expect(createEngineCompanyStandingReader(URL).get('c-1', 'u-1')).rejects.toThrow(
      'governança indisponível',
    )
  })
})

describe('engineDeclarationSource', () => {
  const pending = {
    declarations: [
      {
        id: 'd-1',
        company_id: 'c-1',
        name: 'Acme',
        sector: 'Varejo',
        tickers: ['ACME3'],
        cycle_index: 0,
        report_day: 91,
        held_day: 91,
        days_held: 3,
        safety_deadline_day: 151,
        decision_assembly_id: null,
        release_requested: false,
      },
    ],
  }

  it('lê as declarações retidas do motor', async () => {
    const fetchFn = mockFetch(200, pending)
    const list = await createEngineDeclarationSource(URL).listPending()
    expect(fetchFn.mock.calls[0][0]).toBe(`${URL}/governance/pending-declarations`)
    expect(list).toEqual([
      {
        id: 'd-1',
        companyId: 'c-1',
        name: 'Acme',
        sector: 'Varejo',
        tickers: ['ACME3'],
        reportDay: 91,
        daysHeld: 3,
        safetyDeadlineDay: 151,
        decisionAssemblyId: null,
        releaseRequested: false,
      },
    ])
  })

  it('motor fora do ar devolve erro (a abertura não segue sem saber o que está retido)', async () => {
    mockFetch(503, { error: 'indisponível' })
    await expect(createEngineDeclarationSource(URL).listPending()).rejects.toBeInstanceOf(
      GovernanceEngineUnavailableError,
    )
  })

  it('pede a liberação com o motivo', async () => {
    const fetchFn = mockFetch(200, { id: 'd-1', release_requested: true })
    await createEngineDeclarationSource(URL).release('d-1', 'no_decision')
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`${URL}/governance/pending-declarations/d-1/release`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ reason: 'no_decision' })
  })

  it('declaração que já saiu (404) não é erro', async () => {
    mockFetch(404, { error: 'declaração não encontrada' })
    await expect(
      createEngineDeclarationSource(URL).release('d-1', 'admin'),
    ).resolves.toBeUndefined()
  })

  it('outro erro do motor propaga', async () => {
    mockFetch(400, { error: 'motivo inválido' })
    await expect(createEngineDeclarationSource(URL).release('d-1', 'admin')).rejects.toThrow(
      'motivo',
    )
  })
})
