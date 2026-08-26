import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InvalidMacroEventError } from '../../domain/errors'
import { createEngineMacroEventTrigger } from './engineMacroEventTrigger'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

const sampleResult = {
  id: 'event-1',
  template_key: 'legislacao-ambiental-mineracao',
  title: 'título',
  narrative: 'narrativa',
  direction: 'negativo',
  magnitude_band: 'moderado',
  affects_price: true,
  affects_fundamentals: true,
  status: 'pendente',
  triggered_on_day: 10,
  duration_days: 2,
  price_effect_pct: -10,
  fundamentals_effect_pct: -12,
  fundamentals_report_day: 14,
}

describe('engineMacroEventTrigger', () => {
  it('chama POST /macro-events no motor com o payload repassado', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 201, json: async () => sampleResult })
    const trigger = createEngineMacroEventTrigger('http://engine:8080')

    const input = {
      template_key: 'legislacao-ambiental-mineracao',
      targets: [{ sector: 'Mineração' }],
    }
    const result = await trigger.trigger(input)

    expect(fetchMock).toHaveBeenCalledWith('http://engine:8080/macro-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    expect(result).toEqual(sampleResult)
  })

  it('traduz 400 do motor em InvalidMacroEventError', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'template de evento macro desconhecido' }),
    })
    const trigger = createEngineMacroEventTrigger('http://engine:8080')

    await expect(
      trigger.trigger({ template_key: 'x', targets: [{ sector: 'Mineração' }] }),
    ).rejects.toThrow(InvalidMacroEventError)
  })

  it('lança erro genérico em qualquer outra falha do motor', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })
    const trigger = createEngineMacroEventTrigger('http://engine:8080')

    await expect(
      trigger.trigger({ template_key: 'x', targets: [{ sector: 'Mineração' }] }),
    ).rejects.toThrow(/falha ao disparar evento macro/)
  })
})
