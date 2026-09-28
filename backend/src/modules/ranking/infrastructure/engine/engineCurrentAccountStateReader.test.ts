import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEngineCurrentAccountStateReader } from './engineCurrentAccountStateReader'

function jsonResponse(body: unknown) {
  return { ok: true, json: async () => body }
}

// mockEngine roteia cada chamada de `fetch` pelo caminho da URL — o reader
// faz várias chamadas (conta, posições, catálogo, book por ativo), cada uma
// precisando de uma resposta diferente.
function mockEngine(routes: {
  account: unknown
  positions: unknown[]
  fixedIncomePositions?: unknown[]
  assets?: unknown[]
  booksByAssetId?: Record<string, unknown>
}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.includes('/fixed-income/positions')) {
        return jsonResponse(routes.fixedIncomePositions ?? [])
      }
      if (url.includes('/positions')) {
        return jsonResponse(routes.positions)
      }
      if (url.includes('/accounts/')) {
        return jsonResponse(routes.account)
      }
      const bookMatch = url.match(/\/assets\/([^/]+)\/book/)
      if (bookMatch) {
        return jsonResponse(routes.booksByAssetId?.[bookMatch[1]])
      }
      if (url.endsWith('/assets')) {
        return jsonResponse(routes.assets ?? [])
      }
      throw new Error(`URL inesperada no teste: ${url}`)
    }),
  )
}

describe('engineCurrentAccountStateReader', () => {
  afterEach(() => vi.unstubAllGlobals())

  const reader = createEngineCurrentAccountStateReader('http://engine')

  it('marca posição de renda variável ao ponto médio do book quando os dois lados existem', async () => {
    mockEngine({
      account: {
        current_balance: 1000,
        total_invested: 300,
        total_disinvested: 0,
        total_dividends_received: 0,
      },
      positions: [{ asset_id: 'asset-1', is_sandbox: false, quantity: 10, average_price: 30 }],
      assets: [{ id: 'asset-1', current_price: 999 }],
      booksByAssetId: { 'asset-1': { mid_price: 32.25 } },
    })

    const snapshot = await reader.getCurrentSnapshot('user-1')

    // 10 * 32.25 = 322.5 — nunca 10 * 999 (último negócio), que só entraria
    // se o book não tivesse os dois lados (fallback).
    expect(snapshot.variableIncomeValue).toBe(322.5)
    expect(snapshot.total).toBe(1000 + 322.5)
  })

  it('cai pro último preço negociado quando o book não tem os dois lados', async () => {
    mockEngine({
      account: {
        current_balance: 1000,
        total_invested: 300,
        total_disinvested: 0,
        total_dividends_received: 0,
      },
      positions: [{ asset_id: 'asset-1', is_sandbox: false, quantity: 10, average_price: 30 }],
      assets: [{ id: 'asset-1', current_price: 40 }],
      booksByAssetId: { 'asset-1': { mid_price: null } },
    })

    const snapshot = await reader.getCurrentSnapshot('user-1')

    expect(snapshot.variableIncomeValue).toBe(400)
  })

  it('um negócio de 1 cota (wash trade) não move a marcação de outra carteira além do ponto médio', async () => {
    // duas carteiras diferentes seguram o mesmo ativo; o último negócio foi
    // manipulado por um negócio de 1 cota bem fora do book, mas os dois
    // lados do book seguem com oferta real — a marcação das duas carteiras
    // usa o mesmo ponto médio, nunca o último negócio manipulado.
    mockEngine({
      account: {
        current_balance: 0,
        total_invested: 3000,
        total_disinvested: 0,
        total_dividends_received: 0,
      },
      positions: [{ asset_id: 'asset-1', is_sandbox: false, quantity: 100, average_price: 30 }],
      assets: [{ id: 'asset-1', current_price: 5000 }],
      booksByAssetId: { 'asset-1': { mid_price: 32 } },
    })

    const snapshot = await reader.getCurrentSnapshot('user-1')

    expect(snapshot.variableIncomeValue).toBe(100 * 32)
  })

  it('posição sandbox nunca entra na valorização nem gera chamada de book', async () => {
    const fetchSpy = vi.fn(async (url: string) => {
      if (url.includes('/fixed-income/positions')) return jsonResponse([])
      if (url.includes('/positions')) {
        return jsonResponse([
          { asset_id: 'sand-1', is_sandbox: true, quantity: 5, average_price: 100 },
        ])
      }
      if (url.includes('/accounts/'))
        return jsonResponse({
          current_balance: 1000,
          total_invested: 500,
          total_disinvested: 0,
          total_dividends_received: 0,
        })
      throw new Error(`URL inesperada no teste: ${url}`)
    })
    vi.stubGlobal('fetch', fetchSpy)

    const snapshot = await reader.getCurrentSnapshot('user-1')

    expect(snapshot.variableIncomeValue).toBe(0)
    expect(snapshot.total).toBe(1000)
    expect(fetchSpy.mock.calls.some(([url]) => (url as string).includes('/book'))).toBe(false)
    expect(fetchSpy.mock.calls.some(([url]) => (url as string).endsWith('/assets'))).toBe(false)
  })

  it('lê investedCost/disinvestedProceeds/dividendsReceived direto dos acumuladores crus da conta (tarefa T.1)', async () => {
    mockEngine({
      account: {
        current_balance: 1000,
        total_invested: 3000,
        total_disinvested: 1300,
        total_dividends_received: 50,
      },
      positions: [],
    })

    const snapshot = await reader.getCurrentSnapshot('user-1')

    expect(snapshot.investedCost).toBe(3000)
    expect(snapshot.disinvestedProceeds).toBe(1300)
    expect(snapshot.dividendsReceived).toBe(50)
  })

  it('falha quando o motor responde erro', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    await expect(reader.getCurrentSnapshot('user-1')).rejects.toThrow('status 500')
  })
})
