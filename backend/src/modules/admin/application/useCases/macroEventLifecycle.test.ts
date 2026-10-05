import { describe, expect, it } from 'vitest'
import { MacroEventConflictError, MacroEventNotFoundError } from '../../domain/errors'
import { createFakeAuditLogRepository } from '../../test/fakes/fakeAuditLogRepository'
import {
  createFakeMacroEventAdmin,
  fakeUserViewProjector,
} from '../../test/fakes/fakeMacroEventAdmin'
import { CancelMacroEventUseCase } from './cancelMacroEvent'
import { GetMacroEventDetailUseCase } from './getMacroEventDetail'
import { RecordAdminActionUseCase } from './recordAdminAction'

function build() {
  const macroEventAdmin = createFakeMacroEventAdmin()
  const auditLog = createFakeAuditLogRepository()
  return {
    macroEventAdmin,
    auditLog,
    detail: new GetMacroEventDetailUseCase(macroEventAdmin, fakeUserViewProjector),
    cancel: new CancelMacroEventUseCase(macroEventAdmin, new RecordAdminActionUseCase(auditLog)),
  }
}

describe('GetMacroEventDetailUseCase', () => {
  it('devolve o detalhe do motor com a versão que o usuário vê, sem auditar', async () => {
    const { detail, macroEventAdmin, auditLog } = build()

    const result = await detail.execute('event-1', 7)

    expect(macroEventAdmin.detailCalls).toEqual([{ eventId: 'event-1', windowDays: 7 }])
    expect(result.direction).toBe('negativo')
    expect(result.user_view).toMatchObject({ id: 'event-1', direction: '', targets: [] })
    expect(auditLog.entries).toHaveLength(0)
  })

  it('propaga o 404 do motor', async () => {
    const { detail, macroEventAdmin } = build()
    macroEventAdmin.errorToThrow = new MacroEventNotFoundError('evento macro não encontrado')
    await expect(detail.execute('x')).rejects.toThrow(MacroEventNotFoundError)
  })
})

describe('CancelMacroEventUseCase', () => {
  it('cancela no motor e audita macro_event.cancel com o alvo e o dia agendado', async () => {
    const { cancel, macroEventAdmin, auditLog } = build()

    const event = await cancel.execute('admin-1', 'event-1')

    expect(event.status).toBe('cancelado')
    expect(macroEventAdmin.cancelled).toEqual(['event-1'])
    expect(auditLog.entries[0]).toMatchObject({
      adminId: 'admin-1',
      action: 'macro_event.cancel',
      targetType: 'macro_event',
      targetId: 'event-1',
      result: 'success',
      payload: { title: 'título', triggered_on_day: 130 },
    })
  })

  it('motor recusa (já aplicado): propaga e audita como falha com o motivo', async () => {
    const { cancel, macroEventAdmin, auditLog } = build()
    macroEventAdmin.errorToThrow = new MacroEventConflictError(
      'só um evento pendente pode ser cancelado',
    )

    await expect(cancel.execute('admin-1', 'event-1')).rejects.toThrow(MacroEventConflictError)
    expect(auditLog.entries[0]).toMatchObject({
      action: 'macro_event.cancel',
      targetId: 'event-1',
      result: 'failed',
      errorMessage: 'só um evento pendente pode ser cancelado',
    })
  })
})
