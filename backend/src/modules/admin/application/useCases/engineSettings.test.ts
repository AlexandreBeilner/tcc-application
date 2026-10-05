import { describe, expect, it } from 'vitest'
import { EngineSettingRejectedError } from '../../domain/errors'
import { createFakeAuditLogRepository } from '../../test/fakes/fakeAuditLogRepository'
import { createFakeEngineSettingsAdmin } from '../../test/fakes/fakeEngineSettingsAdmin'
import { ListEngineSettingsUseCase } from './listEngineSettings'
import { RecordAdminActionUseCase } from './recordAdminAction'
import { ResetEngineSettingUseCase } from './resetEngineSetting'
import { UpdateEngineSettingUseCase } from './updateEngineSetting'

function build() {
  const engineSettingsAdmin = createFakeEngineSettingsAdmin()
  const auditLog = createFakeAuditLogRepository()
  const record = new RecordAdminActionUseCase(auditLog)
  return {
    engineSettingsAdmin,
    auditLog,
    list: new ListEngineSettingsUseCase(engineSettingsAdmin),
    update: new UpdateEngineSettingUseCase(engineSettingsAdmin, record),
    reset: new ResetEngineSettingUseCase(engineSettingsAdmin, record),
  }
}

describe('ListEngineSettingsUseCase', () => {
  it('delega ao motor e não audita', async () => {
    const { list, auditLog } = build()
    expect((await list.execute()).editable).toHaveLength(2)
    expect(auditLog.entries).toHaveLength(0)
  })
})

describe('UpdateEngineSettingUseCase', () => {
  it('grava no motor com o admin do token e audita settings.update com o valor', async () => {
    const { update, engineSettingsAdmin, auditLog } = build()

    await update.execute('admin-1', 'ticks_per_day', 12)

    expect(engineSettingsAdmin.saved).toEqual([
      { key: 'ticks_per_day', value: 12, adminId: 'admin-1' },
    ])
    expect(auditLog.entries[0]).toMatchObject({
      adminId: 'admin-1',
      action: 'settings.update',
      targetType: 'engine_setting',
      targetId: 'ticks_per_day',
      result: 'success',
      payload: { key: 'ticks_per_day', value: 12 },
    })
  })

  it('valor fora da faixa: propaga o erro e audita como falha', async () => {
    const { update, engineSettingsAdmin, auditLog } = build()
    engineSettingsAdmin.errorToThrow = new EngineSettingRejectedError('fora da faixa')

    await expect(update.execute('admin-1', 'max_catch_up', 99)).rejects.toThrow(
      EngineSettingRejectedError,
    )
    expect(auditLog.entries[0]).toMatchObject({
      action: 'settings.update',
      result: 'failed',
      errorMessage: 'fora da faixa',
    })
  })
})

describe('ResetEngineSettingUseCase', () => {
  it('restaura no motor e audita settings.reset', async () => {
    const { reset, engineSettingsAdmin, auditLog } = build()

    await reset.execute('admin-2', 'max_catch_up')

    expect(engineSettingsAdmin.resets).toEqual(['max_catch_up'])
    expect(auditLog.entries[0]).toMatchObject({
      adminId: 'admin-2',
      action: 'settings.reset',
      targetId: 'max_catch_up',
      result: 'success',
    })
  })
})
