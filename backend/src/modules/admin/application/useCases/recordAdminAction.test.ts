import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFakeAuditLogRepository } from '../../test/fakes/fakeAuditLogRepository'
import { RecordAdminActionUseCase } from './recordAdminAction'

const spec = {
  adminId: 'admin-1',
  action: 'tick.trigger' as const,
  targetType: 'tick',
  payload: { origem: 'painel' },
}

describe('RecordAdminActionUseCase', () => {
  afterEach(() => vi.restoreAllMocks())

  it('devolve o resultado da operação e grava success mesclando o desfecho no payload', async () => {
    const auditLog = createFakeAuditLogRepository()
    const useCase = new RecordAdminActionUseCase(auditLog)

    const result = await useCase.run(
      spec,
      async () => ({ day: 4 }),
      (r) => ({ targetId: String(r.day), payload: { day: r.day } }),
    )

    expect(result).toEqual({ day: 4 })
    expect(auditLog.entries).toEqual([
      expect.objectContaining({
        adminId: 'admin-1',
        action: 'tick.trigger',
        targetType: 'tick',
        targetId: '4',
        payload: { origem: 'painel', day: 4 },
        result: 'success',
        errorMessage: undefined,
      }),
    ])
  })

  it('relança o erro original e grava failed com a mensagem', async () => {
    const auditLog = createFakeAuditLogRepository()
    const useCase = new RecordAdminActionUseCase(auditLog)
    const original = new Error('motor recusou')

    await expect(
      useCase.run(spec, async () => {
        throw original
      }),
    ).rejects.toBe(original)

    expect(auditLog.entries[0]).toMatchObject({
      result: 'failed',
      errorMessage: 'motor recusou',
      payload: { origem: 'painel' },
    })
  })

  it('erro que não é Error vira texto na mensagem de falha', async () => {
    const auditLog = createFakeAuditLogRepository()
    const useCase = new RecordAdminActionUseCase(auditLog)

    await expect(
      useCase.run(spec, async () => {
        throw 'falhou'
      }),
    ).rejects.toBe('falhou')

    expect(auditLog.entries[0]?.errorMessage).toBe('falhou')
  })

  it('falha ao gravar a auditoria não troca o resultado de uma ação que já aconteceu', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const auditLog = createFakeAuditLogRepository()
    auditLog.appendError = new Error('banco fora do ar')
    const useCase = new RecordAdminActionUseCase(auditLog)

    const result = await useCase.run(spec, async () => 'ok')

    expect(result).toBe('ok')
    expect(consoleError).toHaveBeenCalled()
  })

  it('falha ao gravar a auditoria de uma falha preserva o erro original da operação', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const auditLog = createFakeAuditLogRepository()
    auditLog.appendError = new Error('banco fora do ar')
    const useCase = new RecordAdminActionUseCase(auditLog)

    await expect(
      useCase.run(spec, async () => {
        throw new Error('motor recusou')
      }),
    ).rejects.toThrow('motor recusou')
  })
})
