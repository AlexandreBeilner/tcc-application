import express from 'express'
import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import type { AssemblyAdmin } from '../../application/ports/assemblyAdmin'
import {
  CreateAgendaTemplateAdminUseCase,
  GetAssemblyAdminDetailUseCase,
  LiftAssemblyPauseAdminUseCase,
  ListAgendaTemplatesAdminUseCase,
  ListAssembliesAdminUseCase,
  ListAssemblyPausesAdminUseCase,
  ListAssemblySettingsAdminUseCase,
  PauseAssembliesAdminUseCase,
  ResetAssemblySettingAdminUseCase,
  SetAgendaTemplateActiveAdminUseCase,
  UpdateAgendaTemplateAdminUseCase,
  UpdateAssemblySettingAdminUseCase,
} from '../../application/useCases/assemblyAdmin'
import { RecordAdminActionUseCase } from '../../application/useCases/recordAdminAction'
import {
  AdminAssemblyConflictError,
  AdminAssemblyNotFoundError,
  InvalidAdminAssemblyError,
} from '../../domain/errors'
import { createFakeAuditLogRepository } from '../../test/fakes/fakeAuditLogRepository'
import { createAdminAssembliesRouter } from './adminAssembliesRouter'

const ID = '9d0b8f1e-3c1a-4a52-9b0e-2f6f5f0d1a99'

// O fluxo completo (regra, auditoria e persistência em fakes) está em
// infrastructure/assemblies/inProcessAssemblyAdmin.test.ts; aqui só o que é da borda HTTP: o
// mapeamento dos erros de domínio para 404, 409 e 422.
function buildApp(failWith: Error) {
  const fail = async () => {
    throw failWith
  }
  const assemblyAdmin = {
    getAssembly: fail,
    pause: fail,
    lift: fail,
    setSetting: fail,
    createTemplate: fail,
  } as unknown as AssemblyAdmin
  const tokenIssuer = createFakeTokenIssuer()
  const authMiddleware = createAuthMiddleware(tokenIssuer)
  const record = new RecordAdminActionUseCase(createFakeAuditLogRepository())
  const app = express()
  app.use(express.json())
  app.use(
    createAdminAssembliesRouter({
      listAssemblies: new ListAssembliesAdminUseCase(assemblyAdmin),
      getAssembly: new GetAssemblyAdminDetailUseCase(assemblyAdmin),
      listPauses: new ListAssemblyPausesAdminUseCase(assemblyAdmin),
      pauseAssemblies: new PauseAssembliesAdminUseCase(assemblyAdmin, record),
      liftPause: new LiftAssemblyPauseAdminUseCase(assemblyAdmin, record),
      listSettings: new ListAssemblySettingsAdminUseCase(assemblyAdmin),
      updateSetting: new UpdateAssemblySettingAdminUseCase(assemblyAdmin, record),
      resetSetting: new ResetAssemblySettingAdminUseCase(assemblyAdmin, record),
      listTemplates: new ListAgendaTemplatesAdminUseCase(assemblyAdmin),
      createTemplate: new CreateAgendaTemplateAdminUseCase(assemblyAdmin, record),
      updateTemplate: new UpdateAgendaTemplateAdminUseCase(assemblyAdmin, record),
      setTemplateActive: new SetAgendaTemplateActiveAdminUseCase(assemblyAdmin, record),
      authMiddleware,
    }),
  )
  const adminToken = () => `Bearer ${tokenIssuer.issue({ sub: 'admin-1', role: 'admin' })}`
  return { app, adminToken }
}

const templateBody = {
  key: 'abc',
  sector: null,
  title: 'Pauta',
  description: 'Descrição da pauta.',
  options: [
    {
      key: 'aa',
      label: 'A',
      gain: 'g',
      loss: 'l',
      effect: { metric: 'm', direction: 1, intensity: 1 },
    },
  ],
}

describe('adminAssembliesRouter: erros de domínio na borda HTTP', () => {
  it.each([
    [new AdminAssemblyNotFoundError('não encontrada'), 404],
    [new AdminAssemblyConflictError('conflito'), 409],
    [new InvalidAdminAssemblyError('inválido'), 422],
  ])('%s vira %i em cada rota que escreve ou lê um recurso', async (error, status) => {
    const { app, adminToken } = buildApp(error)
    const auth = { Authorization: adminToken() }
    expect((await request(app).get(`/admin/assemblies/${ID}`).set(auth)).status).toBe(status)
    expect(
      (
        await request(app)
          .post('/admin/assemblies/pauses')
          .set(auth)
          .send({ scope: 'global', reason: 'motivo' })
      ).status,
    ).toBe(status)
    expect((await request(app).post(`/admin/assemblies/pauses/${ID}/lift`).set(auth)).status).toBe(
      status,
    )
    expect(
      (await request(app).put('/admin/assemblies/settings/min_voters').set(auth).send({ value: 4 }))
        .status,
    ).toBe(status)
    expect(
      (await request(app).post('/admin/assemblies/agenda-templates').set(auth).send(templateBody))
        .status,
    ).toBe(status)
  })

  it('erro inesperado não vira 4xx: segue para o handler de erro (500)', async () => {
    const { app, adminToken } = buildApp(new Error('banco caiu'))
    const res = await request(app).get(`/admin/assemblies/${ID}`).set('Authorization', adminToken())
    expect(res.status).toBe(500)
  })
})
