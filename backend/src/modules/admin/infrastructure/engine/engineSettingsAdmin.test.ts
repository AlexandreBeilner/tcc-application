import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EngineSettingNotFoundError, EngineSettingRejectedError } from '../../domain/errors'
import { sampleSettings } from '../../test/fakes/fakeEngineSettingsAdmin'
import { createEngineSettingsAdmin } from './engineSettingsAdmin'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

const engine = () => createEngineSettingsAdmin('http://engine:8080')

function respond(status: number, body: unknown) {
  fetchMock.mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body })
}

describe('engineSettingsAdmin', () => {
  it('list chama GET /admin/settings', async () => {
    respond(200, sampleSettings)
    expect(await engine().list()).toEqual(sampleSettings)
    expect(fetchMock.mock.calls[0][0]).toBe('http://engine:8080/admin/settings')
  })

  it('não repassa à tela os parâmetros de governança que o motor também guarda (MO.6.2)', async () => {
    const governance = { ...sampleSettings.editable[0], key: 'governance_ramp_ticks' }
    respond(200, { ...sampleSettings, editable: [...sampleSettings.editable, governance] })
    const result = await engine().list()
    expect(result.editable.map((s) => s.key)).toEqual(sampleSettings.editable.map((s) => s.key))
  })

  it('o grupo de governança devolve só os parâmetros da assembleia e nunca o ritmo', async () => {
    const governance = { ...sampleSettings.editable[0], key: 'governance_ramp_ticks' }
    respond(200, { ...sampleSettings, editable: [...sampleSettings.editable, governance] })
    const result = await engine().list('governance')
    expect(result.editable.map((s) => s.key)).toEqual(['governance_ramp_ticks'])
  })

  it('os parâmetros de payout, prêmio da PN e retenção do dividendo entram no grupo de governança (MO.6.10 a MO.6.12)', async () => {
    const keys = [
      'governance_payout_step_centipp',
      'governance_payout_min_pct',
      'governance_payout_max_pct',
      'governance_payout_cooldown_days',
      'governance_premium_step_centipp',
      'governance_premium_min_pct',
      'governance_premium_max_pct',
      'governance_hold_declarations',
      'governance_declaration_safety_days',
    ]
    respond(200, {
      ...sampleSettings,
      editable: [
        ...sampleSettings.editable,
        ...keys.map((key) => ({ ...sampleSettings.editable[0], key })),
      ],
    })
    expect((await engine().list('governance')).editable.map((s) => s.key)).toEqual(keys)
    // E nunca aparecem na tela do ritmo.
    respond(200, {
      ...sampleSettings,
      editable: [
        ...sampleSettings.editable,
        ...keys.map((key) => ({ ...sampleSettings.editable[0], key })),
      ],
    })
    expect((await engine().list()).editable.map((s) => s.key)).toEqual(
      sampleSettings.editable.map((s) => s.key),
    )
  })

  it('gravar e restaurar um parâmetro de governança devolve o grupo dele', async () => {
    const governance = { ...sampleSettings.editable[0], key: 'governance_cooldown_days' }
    respond(200, { ...sampleSettings, editable: [...sampleSettings.editable, governance] })
    const saved = await engine().set('governance_cooldown_days', 60, 'admin-1')
    expect(saved.editable.map((s) => s.key)).toEqual(['governance_cooldown_days'])
    expect((await engine().reset('governance_cooldown_days')).editable).toHaveLength(1)
    // O ritmo continua no grupo dele.
    expect((await engine().set('ticks_per_day', 12, 'admin-1')).editable.map((s) => s.key)).toEqual(
      sampleSettings.editable.map((s) => s.key),
    )
  })

  it('set envia PUT com o valor e o admin_id', async () => {
    respond(200, sampleSettings)
    await engine().set('ticks_per_day', 12, 'admin-1')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://engine:8080/admin/settings/ticks_per_day')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body)).toEqual({ value: 12, admin_id: 'admin-1' })
  })

  it('reset envia DELETE', async () => {
    respond(200, sampleSettings)
    await engine().reset('max_catch_up')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://engine:8080/admin/settings/max_catch_up')
    expect(init.method).toBe('DELETE')
  })

  it('traduz 422 e 404 do motor em erros de domínio com a mensagem dele', async () => {
    respond(422, { error: 'ticks_per_day precisa ser um inteiro entre 1 e 24' })
    await expect(engine().set('ticks_per_day', 99, 'a')).rejects.toThrow(EngineSettingRejectedError)
    respond(404, { error: 'parâmetro desconhecido ou somente leitura' })
    await expect(engine().reset('max_catch_up')).rejects.toThrow(EngineSettingNotFoundError)
  })

  it('outro status de erro vira erro genérico', async () => {
    respond(500, {})
    await expect(engine().list()).rejects.toThrow('status 500')
  })
})
