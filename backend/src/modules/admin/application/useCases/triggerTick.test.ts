import { describe, expect, it } from 'vitest'
import { createFakeTickTrigger } from '../../test/fakes/fakeTickTrigger'
import { createFakeAuditLogRepository } from '../../test/fakes/fakeAuditLogRepository'
import { RecordAdminActionUseCase } from './recordAdminAction'
import { TriggerTickUseCase } from './triggerTick'

const sampleResult = {
  day: 10,
  selic_rate: 10.75,
  quotes_count: 24,
  fundamentals_count: 0,
  is_copom_day: false,
  is_report_day: false,
  dividends_generated_count: 0,
  dividends_paid_count: 0,
  bot_fills_count: 3,
  expired_orders_count: 0,
  uncovered_assets_count: 0,
  intraday_rounds_count: 2,
}

function build(tickTrigger = createFakeTickTrigger(sampleResult)) {
  const auditLog = createFakeAuditLogRepository()
  const useCase = new TriggerTickUseCase(tickTrigger, new RecordAdminActionUseCase(auditLog))
  return { useCase, tickTrigger, auditLog }
}

describe('TriggerTickUseCase', () => {
  it('chama a port, devolve o resultado e audita o disparo como sucesso', async () => {
    const { useCase, tickTrigger, auditLog } = build()

    const result = await useCase.execute('admin-1')

    expect(result).toEqual(sampleResult)
    expect(tickTrigger.calls).toBe(1)
    expect(auditLog.entries).toHaveLength(1)
    expect(auditLog.entries[0]).toMatchObject({
      adminId: 'admin-1',
      action: 'tick.trigger',
      targetType: 'tick',
      targetId: '10',
      payload: { day: 10 },
      result: 'success',
    })
  })

  it('propaga erro da port (ex: TickInProgressError) e audita como falha com o motivo', async () => {
    const tickTrigger = createFakeTickTrigger(sampleResult)
    tickTrigger.errorToThrow = new Error('já existe um tick em andamento')
    const { useCase, auditLog } = build(tickTrigger)

    await expect(useCase.execute('admin-1')).rejects.toThrow('já existe um tick em andamento')

    expect(auditLog.entries).toHaveLength(1)
    expect(auditLog.entries[0]).toMatchObject({
      action: 'tick.trigger',
      result: 'failed',
      errorMessage: 'já existe um tick em andamento',
    })
  })
})
