import { describe, expect, it } from 'vitest'
import { createFakeUserRepository } from '../../../auth/test/fakes/fakeUserRepository'
import {
  AdminCorrectionConflictError,
  AdminUserNotFoundError,
  ProGrantRejectedError,
  ProGrantUnavailableError,
} from '../../domain/errors'
import { createFakeAuditLogRepository } from '../../test/fakes/fakeAuditLogRepository'
import { createFakeUserProGrants } from '../../test/fakes/fakeUserProGrants'
import { RecordAdminActionUseCase } from './recordAdminAction'
import { GetUserProStatusUseCase, GrantUserProUseCase } from './userProGrants'

const NOW = new Date('2026-10-11T12:00:00Z')
const DAY = 86_400_000

async function build() {
  const userRepository = createFakeUserRepository()
  const user = await userRepository.createUser({
    name: 'Fulano',
    email: 'fulano@example.com',
    username: 'fulano',
    passwordHash: 'x',
  })
  const proGrants = createFakeUserProGrants()
  const auditLog = createFakeAuditLogRepository()
  return {
    user,
    proGrants,
    auditLog,
    grant: new GrantUserProUseCase(
      userRepository,
      proGrants,
      new RecordAdminActionUseCase(auditLog),
      () => NOW,
    ),
    status: new GetUserProStatusUseCase(userRepository, proGrants),
  }
}

describe('GrantUserProUseCase', () => {
  it('quem não é PRO ganha N dias a partir de agora e a ação é auditada com o motivo', async () => {
    const { grant, user, proGrants, auditLog } = await build()

    const result = await grant.execute('admin-1', user.id, { days: 30, reason: 'parceria' })

    expect(result.endsAt).toEqual(new Date(NOW.getTime() + 30 * DAY))
    expect(result.previousAccessEnd).toBeNull()
    expect(proGrants.granted).toEqual([{ userId: user.id, endsAt: result.endsAt }])
    expect(auditLog.entries[0]).toMatchObject({
      adminId: 'admin-1',
      action: 'billing.grant_promotional',
      targetType: 'user',
      targetId: user.id,
      result: 'success',
      payload: {
        days: 30,
        reason: 'parceria',
        ends_at: result.endsAt.toISOString(),
        previous_access_end: null,
      },
    })
  })

  it('empilha depois do fim do acesso atual em vez de sobrepor', async () => {
    const { grant, user, proGrants } = await build()
    const currentEnd = new Date(NOW.getTime() + 10 * DAY)
    proGrants.accessEnd = currentEnd

    const result = await grant.execute('admin-1', user.id, { days: 7, reason: 'cortesia' })

    expect(result.endsAt).toEqual(new Date(currentEnd.getTime() + 7 * DAY))
    expect(result.previousAccessEnd).toEqual(currentEnd)
  })

  it('acesso que já venceu conta a partir de agora', async () => {
    const { grant, user, proGrants } = await build()
    proGrants.accessEnd = new Date(NOW.getTime() - 3 * DAY)

    const result = await grant.execute('admin-1', user.id, { days: 1, reason: 'cortesia' })

    expect(result.endsAt).toEqual(new Date(NOW.getTime() + DAY))
  })

  it.each([0, 91, 1.5, -3])(
    'recusa %s dias, sem chamar o provedor, e audita a falha',
    async (days) => {
      const { grant, user, proGrants, auditLog } = await build()

      await expect(grant.execute('admin-1', user.id, { days, reason: 'teste' })).rejects.toThrow(
        ProGrantRejectedError,
      )
      expect(proGrants.granted).toEqual([])
      expect(auditLog.entries[0]).toMatchObject({
        action: 'billing.grant_promotional',
        result: 'failed',
      })
    },
  )

  it('aceita o teto de 90 dias', async () => {
    const { grant, user } = await build()
    const result = await grant.execute('admin-1', user.id, { days: 90, reason: 'prêmio' })
    expect(result.endsAt).toEqual(new Date(NOW.getTime() + 90 * DAY))
  })

  it('PRO sem vencimento: nada a empilhar, recusa com conflito', async () => {
    const { grant, user, proGrants } = await build()
    proGrants.accessEnd = new Date(8.64e15)

    await expect(grant.execute('admin-1', user.id, { days: 5, reason: 'teste' })).rejects.toThrow(
      AdminCorrectionConflictError,
    )
    expect(proGrants.granted).toEqual([])
  })

  it('usuário inexistente: 404 de domínio e auditoria de falha', async () => {
    const { grant, auditLog } = await build()
    await expect(grant.execute('admin-1', 'nope', { days: 5, reason: 'teste' })).rejects.toThrow(
      AdminUserNotFoundError,
    )
    expect(auditLog.entries[0]).toMatchObject({ result: 'failed' })
  })

  it('cobrança desligada: propaga o erro e audita como falha', async () => {
    const { grant, user, proGrants, auditLog } = await build()
    proGrants.errorToThrow = new ProGrantUnavailableError('cobrança desligada neste ambiente')

    await expect(grant.execute('admin-1', user.id, { days: 5, reason: 'teste' })).rejects.toThrow(
      ProGrantUnavailableError,
    )
    expect(auditLog.entries[0]).toMatchObject({
      result: 'failed',
      errorMessage: 'cobrança desligada neste ambiente',
    })
  })
})

describe('GetUserProStatusUseCase', () => {
  it('devolve o plano da pessoa', async () => {
    const { status, user, proGrants } = await build()
    proGrants.status = {
      isPro: true,
      state: 'active',
      plan: 'monthly',
      store: 'stripe',
      expiresAt: '2026-11-01T00:00:00.000Z',
    }
    expect(await status.execute(user.id)).toMatchObject({ isPro: true, plan: 'monthly' })
  })

  it('usuário inexistente: 404 de domínio', async () => {
    const { status } = await build()
    await expect(status.execute('nope')).rejects.toThrow(AdminUserNotFoundError)
  })
})
