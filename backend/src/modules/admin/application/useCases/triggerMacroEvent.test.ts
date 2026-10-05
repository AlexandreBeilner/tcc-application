import { describe, expect, it } from 'vitest'
import { createFakeMacroEventTrigger } from '../../test/fakes/fakeMacroEventTrigger'
import { createFakeAuditLogRepository } from '../../test/fakes/fakeAuditLogRepository'
import { RecordAdminActionUseCase } from './recordAdminAction'
import { TriggerMacroEventUseCase } from './triggerMacroEvent'

const sampleResult = {
  id: 'event-1',
  title: 'título',
  narrative: 'narrativa',
  direction: 'negativo',
  magnitude_band: 'leve',
  affects_price: true,
  affects_fundamentals: false,
  status: 'pendente',
  triggered_on_day: 5,
  duration_days: 1,
  price_effect_pct: -4,
  targets: [{ sector: 'Financeiro' }],
}

function build(macroEventTrigger = createFakeMacroEventTrigger(sampleResult)) {
  const auditLog = createFakeAuditLogRepository()
  const useCase = new TriggerMacroEventUseCase(
    macroEventTrigger,
    new RecordAdminActionUseCase(auditLog),
  )
  return { useCase, macroEventTrigger, auditLog }
}

describe('TriggerMacroEventUseCase', () => {
  it('repassa o input pra port, devolve o resultado e audita com o id do evento', async () => {
    const { useCase, macroEventTrigger, auditLog } = build()

    const input = {
      template_key: 'legislacao-ambiental-mineracao',
      targets: [{ sector: 'Mineração' }],
    }
    const result = await useCase.execute('admin-1', input)

    expect(result).toEqual(sampleResult)
    expect(macroEventTrigger.calls).toEqual([input])
    expect(auditLog.entries).toHaveLength(1)
    expect(auditLog.entries[0]).toMatchObject({
      adminId: 'admin-1',
      action: 'macro_event.trigger',
      targetType: 'macro_event',
      targetId: 'event-1',
      payload: input,
      result: 'success',
    })
  })

  it('propaga erro da port (ex: InvalidMacroEventError) e audita como falha', async () => {
    const macroEventTrigger = createFakeMacroEventTrigger(sampleResult)
    macroEventTrigger.errorToThrow = new Error('evento macro inválido')
    const { useCase, auditLog } = build(macroEventTrigger)

    await expect(
      useCase.execute('admin-1', { template_key: 'x', targets: [{ sector: 'Mineração' }] }),
    ).rejects.toThrow('evento macro inválido')

    expect(auditLog.entries[0]).toMatchObject({
      action: 'macro_event.trigger',
      targetId: undefined,
      result: 'failed',
      errorMessage: 'evento macro inválido',
      payload: { template_key: 'x' },
    })
  })
})
