import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEngineAssetPriceHistoryReader } from './engineAssetPriceHistoryReader'

const DAY_MS = 24 * 60 * 60 * 1000

function mockQuotes(quotes: Array<{ simulated_day: number; price: number }>) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => quotes }))
}

describe('engineAssetPriceHistoryReader', () => {
  afterEach(() => vi.unstubAllGlobals())

  const reader = createEngineAssetPriceHistoryReader('http://engine')

  it('devolve o fallback quando o ativo nunca teve cotação', async () => {
    mockQuotes([])
    expect(await reader.priceAsOf('a', new Date())).toBe(100)
  })

  it('1 dia real atrás equivale a 5 dias simulados, pulando fim de semana sem cotação', async () => {
    // dias 6 e 7 (sábado/domingo simulados) sem cotação
    mockQuotes([
      { simulated_day: 3, price: 30 },
      { simulated_day: 4, price: 40 },
      { simulated_day: 5, price: 50 },
      { simulated_day: 8, price: 80 },
      { simulated_day: 9, price: 90 },
      { simulated_day: 10, price: 100 },
    ])
    // hoje = dia 10; 1 dia real atrás = dia 5
    expect(await reader.priceAsOf('a', new Date(Date.now() - DAY_MS))).toBe(50)
    // 2 dias reais atrás = dia 0 (antes do histórico): cotação mais antiga
    expect(await reader.priceAsOf('a', new Date(Date.now() - 2 * DAY_MS))).toBe(30)
    // agora = último preço
    expect(await reader.priceAsOf('a', new Date())).toBe(100)
  })

  it('falha quando o motor responde erro', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    await expect(reader.priceAsOf('a', new Date())).rejects.toThrow('status 500')
  })
})
