import { describe, expect, it } from 'vitest'
import { AdminAssemblyConflictError } from '../../domain/errors'
import type { AgendaTemplateContent, AssemblyAdmin } from '../ports/assemblyAdmin'
import { createFakeAuditLogRepository } from '../../test/fakes/fakeAuditLogRepository'
import {
  CreateAgendaTemplateAdminUseCase,
  LiftAssemblyPauseAdminUseCase,
  PauseAssembliesAdminUseCase,
  ResetAssemblySettingAdminUseCase,
  SetAgendaTemplateActiveAdminUseCase,
  UpdateAgendaTemplateAdminUseCase,
  UpdateAssemblySettingAdminUseCase,
} from './assemblyAdmin'
import { RecordAdminActionUseCase } from './recordAdminAction'

const pauseView = {
  id: 'pause-1',
  scope: 'global' as const,
  kind: null,
  subjectRef: null,
  reason: 'motivo',
  createdBy: 'admin-1',
  createdAt: new Date(0),
  liftedAt: null,
  liftedBy: null,
}

const content: AgendaTemplateContent = {
  sector: null,
  title: 'Pauta',
  description: 'Descrição da pauta.',
  options: [
    { key: 'aa', label: 'A', gain: 'g', loss: 'l', effect: {} },
    { key: 'bb', label: 'B', gain: 'g', loss: 'l', effect: {} },
  ],
}

function build(overrides: Partial<AssemblyAdmin> = {}) {
  const calls: unknown[][] = []
  const spy =
    <T>(name: string, result: T) =>
    async (...args: unknown[]) => {
      calls.push([name, ...args])
      return result
    }
  const assemblyAdmin = {
    pause: spy('pause', pauseView),
    lift: spy('lift', pauseView),
    setSetting: spy('setSetting', []),
    resetSetting: spy('resetSetting', []),
    createTemplate: spy('createTemplate', { ...content, key: 'k', active: true }),
    updateTemplate: spy('updateTemplate', { ...content, key: 'k', active: true }),
    setTemplateActive: spy('setTemplateActive', { ...content, key: 'k', active: true }),
    ...overrides,
  } as unknown as AssemblyAdmin
  const auditLog = createFakeAuditLogRepository()
  return { assemblyAdmin, auditLog, calls, record: new RecordAdminActionUseCase(auditLog) }
}

describe('casos de uso de escrita do painel das assembleias (auditoria)', () => {
  it('pausar grava assembly.pause com escopo e motivo, e o id da pausa como alvo', async () => {
    const { assemblyAdmin, auditLog, record } = build()
    await new PauseAssembliesAdminUseCase(assemblyAdmin, record).execute('admin-1', {
      scope: 'subject',
      subjectRef: 'company-1',
      reason: 'revisão',
    })
    expect(auditLog.entries[0]).toMatchObject({
      adminId: 'admin-1',
      action: 'assembly.pause',
      targetType: 'assembly_pause',
      targetId: 'pause-1',
      result: 'success',
      payload: { scope: 'subject', subject_ref: 'company-1', reason: 'revisão' },
    })
  })

  it('a recusa também é auditada (já existe pausa vigente), e o erro segue para o router', async () => {
    const { assemblyAdmin, auditLog, record } = build({
      pause: async () => {
        throw new AdminAssemblyConflictError('já existe uma pausa global vigente')
      },
    })
    await expect(
      new PauseAssembliesAdminUseCase(assemblyAdmin, record).execute('admin-1', {
        scope: 'global',
        reason: 'motivo',
      }),
    ).rejects.toBeInstanceOf(AdminAssemblyConflictError)
    expect(auditLog.entries[0]).toMatchObject({
      action: 'assembly.pause',
      result: 'failed',
      errorMessage: 'já existe uma pausa global vigente',
    })
  })

  it('retomar grava assembly.resume com o id da pausa', async () => {
    const { assemblyAdmin, auditLog, record } = build()
    await new LiftAssemblyPauseAdminUseCase(assemblyAdmin, record).execute('admin-2', 'pause-1')
    expect(auditLog.entries[0]).toMatchObject({
      adminId: 'admin-2',
      action: 'assembly.resume',
      targetType: 'assembly_pause',
      targetId: 'pause-1',
    })
  })

  it('alterar e restaurar parâmetro gravam a chave e o valor novo', async () => {
    const { assemblyAdmin, auditLog, record } = build()
    await new UpdateAssemblySettingAdminUseCase(assemblyAdmin, record).execute(
      'admin-1',
      'min_voters',
      5,
    )
    await new ResetAssemblySettingAdminUseCase(assemblyAdmin, record).execute(
      'admin-1',
      'min_voters',
    )
    expect(auditLog.entries.map((e) => [e.action, e.targetId, e.payload])).toEqual([
      ['assembly.setting_update', 'min_voters', { key: 'min_voters', value: 5 }],
      ['assembly.setting_reset', 'min_voters', { key: 'min_voters' }],
    ])
  })

  it('criar e editar pauta gravam o resumo do conteúdo, sem o texto inteiro', async () => {
    const { assemblyAdmin, auditLog, record } = build()
    await new CreateAgendaTemplateAdminUseCase(assemblyAdmin, record).execute(
      'admin-1',
      'nova_pauta',
      content,
    )
    await new UpdateAgendaTemplateAdminUseCase(assemblyAdmin, record).execute(
      'admin-1',
      'nova_pauta',
      content,
    )
    expect(auditLog.entries.map((e) => [e.action, e.targetType, e.targetId])).toEqual([
      ['assembly.template_create', 'agenda_template', 'nova_pauta'],
      ['assembly.template_update', 'agenda_template', 'nova_pauta'],
    ])
    expect(auditLog.entries[0].payload).toEqual({
      sector: null,
      title: 'Pauta',
      options: ['aa', 'bb'],
    })
  })

  it('ativar e desativar pauta são ações distintas no log', async () => {
    const { assemblyAdmin, auditLog, record } = build()
    const useCase = new SetAgendaTemplateActiveAdminUseCase(assemblyAdmin, record)
    await useCase.execute('admin-1', 'nova_pauta', false)
    await useCase.execute('admin-1', 'nova_pauta', true)
    expect(auditLog.entries.map((e) => e.action)).toEqual([
      'assembly.template_deactivate',
      'assembly.template_activate',
    ])
  })
})
