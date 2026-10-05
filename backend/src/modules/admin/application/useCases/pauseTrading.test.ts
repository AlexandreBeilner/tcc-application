import { describe, expect, it } from 'vitest'
import { TradingHaltConflictError } from '../../domain/errors'
import { createFakeAuditLogRepository } from '../../test/fakes/fakeAuditLogRepository'
import { createFakeTradingHaltAdmin } from '../../test/fakes/fakeTradingHaltAdmin'
import { LiftTradingHaltUseCase } from './liftTradingHalt'
import { PauseTradingUseCase } from './pauseTrading'
import { RecordAdminActionUseCase } from './recordAdminAction'

function build() {
  const tradingHaltAdmin = createFakeTradingHaltAdmin()
  const auditLog = createFakeAuditLogRepository()
  const record = new RecordAdminActionUseCase(auditLog)
  return {
    tradingHaltAdmin,
    auditLog,
    pause: new PauseTradingUseCase(tradingHaltAdmin, record),
    lift: new LiftTradingHaltUseCase(tradingHaltAdmin, record),
  }
}

describe('PauseTradingUseCase', () => {
  it('pausa no motor com o admin do token e audita trading.halt com o id da pausa', async () => {
    const { pause, tradingHaltAdmin, auditLog } = build()

    const halt = await pause.execute('admin-1', {
      scope: 'asset',
      assetId: 'asset-1',
      reason: 'volatilidade',
    })

    expect(tradingHaltAdmin.paused).toEqual([
      { input: { scope: 'asset', assetId: 'asset-1', reason: 'volatilidade' }, adminId: 'admin-1' },
    ])
    expect(auditLog.entries[0]).toMatchObject({
      adminId: 'admin-1',
      action: 'trading.halt',
      targetType: 'trading_halt',
      targetId: halt.id,
      result: 'success',
      payload: { scope: 'asset', asset_id: 'asset-1', reason: 'volatilidade' },
    })
  })

  it('pausa global grava asset_id nulo no payload', async () => {
    const { pause, auditLog } = build()
    await pause.execute('admin-1', { scope: 'global', reason: 'manutenção' })
    expect(auditLog.entries[0].payload).toMatchObject({ scope: 'global', asset_id: null })
  })

  it('motor recusa (já pausado): propaga o erro e audita como falha', async () => {
    const { pause, tradingHaltAdmin, auditLog } = build()
    tradingHaltAdmin.errorToThrow = new TradingHaltConflictError('já existe uma pausa vigente')

    await expect(pause.execute('admin-1', { scope: 'global', reason: 'x' })).rejects.toThrow(
      TradingHaltConflictError,
    )
    expect(auditLog.entries[0]).toMatchObject({
      action: 'trading.halt',
      result: 'failed',
      errorMessage: 'já existe uma pausa vigente',
    })
  })
})

describe('LiftTradingHaltUseCase', () => {
  it('retoma no motor e audita trading.resume com o escopo encerrado', async () => {
    const { lift, tradingHaltAdmin, auditLog } = build()

    const halt = await lift.execute('admin-2', 'halt-1')

    expect(halt.lifted_by).toBe('admin-2')
    expect(tradingHaltAdmin.lifted).toEqual([{ haltId: 'halt-1', adminId: 'admin-2' }])
    expect(auditLog.entries[0]).toMatchObject({
      adminId: 'admin-2',
      action: 'trading.resume',
      targetId: 'halt-1',
      result: 'success',
      payload: { scope: 'global', asset_id: null },
    })
  })

  it('pausa já encerrada: propaga e audita a falha', async () => {
    const { lift, tradingHaltAdmin, auditLog } = build()
    tradingHaltAdmin.errorToThrow = new TradingHaltConflictError('a pausa já foi encerrada')

    await expect(lift.execute('admin-1', 'halt-1')).rejects.toThrow(TradingHaltConflictError)
    expect(auditLog.entries[0]).toMatchObject({ action: 'trading.resume', result: 'failed' })
  })
})
