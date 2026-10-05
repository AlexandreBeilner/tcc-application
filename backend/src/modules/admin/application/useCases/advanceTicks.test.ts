import { describe, expect, it } from 'vitest'
import { createFakeAuditLogRepository } from '../../test/fakes/fakeAuditLogRepository'
import { createFakeSchedulerAdmin } from '../../test/fakes/fakeSchedulerAdmin'
import type { TickResult } from '../ports/tickTrigger'
import { AdvanceTicksUseCase } from './advanceTicks'
import { RecordAdminActionUseCase } from './recordAdminAction'

function tick(day: number): TickResult {
  return {
    day,
    selic_rate: 10,
    quotes_count: 24,
    fundamentals_count: 0,
    is_copom_day: false,
    is_report_day: false,
    dividends_generated_count: 0,
    dividends_paid_count: 0,
    bot_fills_count: 0,
    expired_orders_count: 0,
    uncovered_assets_count: 0,
    intraday_rounds_count: 2,
  }
}

function build() {
  const schedulerAdmin = createFakeSchedulerAdmin(undefined, {
    requested: 0,
    ticks: [tick(11), tick(12)],
  })
  const auditLog = createFakeAuditLogRepository()
  const useCase = new AdvanceTicksUseCase(schedulerAdmin, new RecordAdminActionUseCase(auditLog))
  return { useCase, schedulerAdmin, auditLog }
}

describe('AdvanceTicksUseCase', () => {
  it('avança no motor e audita UMA ação com o pedido e o que rodou', async () => {
    const { useCase, schedulerAdmin, auditLog } = build()

    const result = await useCase.execute('admin-1', 2)

    expect(result.requested).toBe(2)
    expect(schedulerAdmin.calls).toEqual(['advance:2'])
    expect(auditLog.entries).toHaveLength(1)
    expect(auditLog.entries[0]).toMatchObject({
      adminId: 'admin-1',
      action: 'tick.advance',
      targetType: 'tick',
      targetId: '12',
      payload: { days: 2, executed: 2, last_day: 12 },
      result: 'success',
    })
  })

  it('sem nenhum tick no resultado não inventa alvo', async () => {
    const { useCase, schedulerAdmin, auditLog } = build()
    schedulerAdmin.advance = async (days) => ({ requested: days, ticks: [] })

    await useCase.execute('admin-1', 3)

    expect(auditLog.entries[0]).toMatchObject({
      targetId: undefined,
      payload: { days: 3, executed: 0, last_day: null },
    })
  })

  it('falha no motor: propaga e audita com o pedido e o motivo', async () => {
    const { useCase, schedulerAdmin, auditLog } = build()
    schedulerAdmin.errorToThrow = new Error('já existe um tick em andamento')

    await expect(useCase.execute('admin-1', 5)).rejects.toThrow('já existe um tick em andamento')

    expect(auditLog.entries[0]).toMatchObject({
      action: 'tick.advance',
      result: 'failed',
      errorMessage: 'já existe um tick em andamento',
      payload: { days: 5 },
    })
  })
})
