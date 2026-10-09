import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEngineAssetTypeLookup } from './engineAssetTypeLookup'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('engineAssetTypeLookup', () => {
  it('devolve o tipo do ticker encontrado e undefined pro que não existe', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { ticker: 'VALR3', type: 'acao' },
        { ticker: 'LFT2029', type: 'tesouro_selic' },
      ],
    })
    vi.stubGlobal('fetch', fetchMock)
    const lookup = createEngineAssetTypeLookup('http://engine')

    expect(await lookup.typeOfTicker('LFT2029')).toBe('tesouro_selic')
    expect(await lookup.typeOfTicker('XXXX9')).toBeUndefined()
    expect(fetchMock.mock.calls[0][0]).toBe('http://engine/assets')
  })

  it('falha do motor propaga (validar sem catálogo seria aceitar qualquer ticker)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))

    await expect(
      createEngineAssetTypeLookup('http://engine').typeOfTicker('VALR3'),
    ).rejects.toThrow(/status 503/)
  })
})
