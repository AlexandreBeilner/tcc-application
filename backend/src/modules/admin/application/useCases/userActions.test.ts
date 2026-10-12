import { createFakeAccountMailer } from '../../../auth/test/fakes/fakeAccountMailer'
import { createFakeEmailDataEraser } from '../../../auth/test/fakes/fakeEmailDataEraser'
import { describe, expect, it } from 'vitest'
import { AnonymizeAccountUseCase } from '../../../auth/application/useCases/anonymizeAccount'
import { createFakeAuthMailer } from '../../../auth/test/fakes/fakeAuthMailer'
import { createFakeAvatarStorage } from '../../../auth/test/fakes/fakeAvatarStorage'
import { createFakeUserRepository } from '../../../auth/test/fakes/fakeUserRepository'
import {
  AdminAccountProtectedError,
  AdminUserNotFoundError,
  DeleteConfirmationMismatchError,
  UserStatusConflictError,
} from '../../domain/errors'
import { createFakeAuditLogRepository } from '../../test/fakes/fakeAuditLogRepository'
import { DeleteUserAccountUseCase } from './deleteUserAccount'
import { ForceLogoutUserUseCase } from './forceLogoutUser'
import { ReactivateUserUseCase } from './reactivateUser'
import { RecordAdminActionUseCase } from './recordAdminAction'
import { SuspendUserUseCase } from './suspendUser'

async function build() {
  const userRepository = createFakeUserRepository()
  const auditLog = createFakeAuditLogRepository()
  const mailer = createFakeAuthMailer()
  const accountMailer = createFakeAccountMailer()
  let seq = 0
  const record = new RecordAdminActionUseCase(auditLog)
  const admin = await userRepository.createUser({
    name: 'Admin',
    email: 'admin@example.com',
    username: 'admin',
    passwordHash: 'x',
    role: 'admin',
  })
  const user = await userRepository.createUser({
    name: 'Fulano',
    email: 'fulano@example.com',
    username: 'fulano',
    passwordHash: 'x',
  })
  const now = new Date('2026-10-03T12:00:00Z')
  return {
    userRepository,
    auditLog,
    mailer,
    accountMailer,
    admin,
    user,
    suspend: new SuspendUserUseCase(
      userRepository,
      record,
      accountMailer,
      () => now,
      () => `evento-${++seq}`,
    ),
    reactivate: new ReactivateUserUseCase(
      userRepository,
      record,
      accountMailer,
      () => `evento-${++seq}`,
    ),
    forceLogout: new ForceLogoutUserUseCase(
      userRepository,
      record,
      mailer,
      () => `evento-${++seq}`,
    ),
    remove: new DeleteUserAccountUseCase(
      userRepository,
      new AnonymizeAccountUseCase(
        userRepository,
        createFakeAvatarStorage(),
        accountMailer,
        createFakeEmailDataEraser(),
      ),
      record,
    ),
    now,
  }
}

describe('SuspendUserUseCase', () => {
  it('suspende com motivo e instante, revoga as sessões e audita', async () => {
    const { suspend, userRepository, user, admin, auditLog, now } = await build()

    await suspend.execute(admin.id, user.id, 'spam no feed')

    const after = await userRepository.findById(user.id)
    expect(after).toMatchObject({
      status: 'suspended',
      suspendedReason: 'spam no feed',
      suspendedAt: now,
      tokenVersion: 1,
    })
    expect(auditLog.entries[0]).toMatchObject({
      action: 'user.suspend',
      targetType: 'user',
      targetId: user.id,
      adminId: admin.id,
      result: 'success',
      payload: { reason: 'spam no feed' },
    })
  })

  it('avisa o usuário com o motivo registrado (E6), e só depois de suspender', async () => {
    const { suspend, accountMailer, user, admin } = await build()

    await suspend.execute(admin.id, user.id, 'spam no feed')

    expect(accountMailer.suspensions).toEqual([
      {
        userId: user.id,
        to: 'fulano@example.com',
        name: 'Fulano',
        reason: 'spam no feed',
        eventId: 'evento-1',
      },
    ])
  })

  it('falha ao enfileirar o aviso não desfaz a suspensão', async () => {
    const { suspend, accountMailer, userRepository, user, admin } = await build()
    accountMailer.failWith(new Error('outbox fora do ar'))

    await suspend.execute(admin.id, user.id, 'spam no feed')

    expect((await userRepository.findById(user.id))?.status).toBe('suspended')
  })

  it('recusa suspender administrador, conta já suspensa e usuário inexistente', async () => {
    const { suspend, admin, user, auditLog, accountMailer } = await build()

    await expect(suspend.execute(admin.id, admin.id, 'teste')).rejects.toBeInstanceOf(
      AdminAccountProtectedError,
    )
    await suspend.execute(admin.id, user.id, 'primeira')
    await expect(suspend.execute(admin.id, user.id, 'segunda')).rejects.toBeInstanceOf(
      UserStatusConflictError,
    )
    await expect(suspend.execute(admin.id, 'nao-existe', 'x')).rejects.toBeInstanceOf(
      AdminUserNotFoundError,
    )
    expect(auditLog.entries.filter((e) => e.result === 'failed')).toHaveLength(3)
    // Só a suspensão que valeu avisa: as três recusas e a segunda tentativa não geram e-mail.
    expect(accountMailer.suspensions).toHaveLength(1)
  })
})

describe('ReactivateUserUseCase', () => {
  it('restaura o acesso e limpa motivo e instante, sem perder o resto', async () => {
    const { suspend, reactivate, userRepository, user, admin, auditLog } = await build()
    await suspend.execute(admin.id, user.id, 'spam no feed')

    await reactivate.execute(admin.id, user.id)

    const after = await userRepository.findById(user.id)
    expect(after).toMatchObject({ status: 'active', suspendedReason: null, suspendedAt: null })
    expect(after?.email).toBe('fulano@example.com')
    expect(auditLog.entries.at(-1)).toMatchObject({ action: 'user.reactivate', result: 'success' })
  })

  it('avisa o usuário que a conta voltou (E6)', async () => {
    const { suspend, reactivate, accountMailer, user, admin } = await build()
    await suspend.execute(admin.id, user.id, 'spam no feed')

    await reactivate.execute(admin.id, user.id)

    expect(accountMailer.reactivations).toEqual([
      { userId: user.id, to: 'fulano@example.com', name: 'Fulano', eventId: 'evento-2' },
    ])
  })

  it('recusa reativar conta que não está suspensa', async () => {
    const { reactivate, accountMailer, user, admin } = await build()
    await expect(reactivate.execute(admin.id, user.id)).rejects.toBeInstanceOf(
      UserStatusConflictError,
    )
    expect(accountMailer.reactivations).toEqual([])
  })
})

describe('ForceLogoutUserUseCase', () => {
  it('incrementa a versão de sessão e audita', async () => {
    const { forceLogout, userRepository, user, admin, auditLog } = await build()

    await forceLogout.execute(admin.id, user.id)
    await forceLogout.execute(admin.id, user.id)

    expect((await userRepository.findById(user.id))?.tokenVersion).toBe(2)
    expect(auditLog.entries.map((e) => e.action)).toEqual([
      'user.force_logout',
      'user.force_logout',
    ])
  })

  it('avisa o usuário por e-mail, um aviso por ação (E4)', async () => {
    const { forceLogout, mailer, user, admin } = await build()

    await forceLogout.execute(admin.id, user.id)
    await forceLogout.execute(admin.id, user.id)

    expect(mailer.sessionsEnded).toEqual([
      { userId: user.id, to: 'fulano@example.com', name: 'Fulano', eventId: 'evento-1' },
      { userId: user.id, to: 'fulano@example.com', name: 'Fulano', eventId: 'evento-2' },
    ])
  })

  it('falha ao enfileirar o aviso não desfaz o logout nem a auditoria', async () => {
    const { forceLogout, mailer, userRepository, user, admin, auditLog } = await build()
    mailer.sendSessionsEnded = async () => {
      throw new Error('outbox fora do ar')
    }

    await forceLogout.execute(admin.id, user.id)

    expect((await userRepository.findById(user.id))?.tokenVersion).toBe(1)
    expect(auditLog.entries.map((e) => e.action)).toEqual(['user.force_logout'])
  })

  it('usuário inexistente não gera aviso', async () => {
    const { forceLogout, mailer, admin } = await build()
    await expect(forceLogout.execute(admin.id, 'nao-existe')).rejects.toBeInstanceOf(
      AdminUserNotFoundError,
    )
    expect(mailer.sessionsEnded).toEqual([])
  })

  it('falha com usuário inexistente', async () => {
    const { forceLogout, admin } = await build()
    await expect(forceLogout.execute(admin.id, 'nao-existe')).rejects.toBeInstanceOf(
      AdminUserNotFoundError,
    )
  })
})

describe('DeleteUserAccountUseCase', () => {
  it('anonimiza com o username confirmado, revoga sessões e audita sem dado pessoal', async () => {
    const { remove, userRepository, user, admin, auditLog } = await build()

    await remove.execute(admin.id, user.id, 'fulano')

    const after = await userRepository.findById(user.id)
    expect(after?.email).toMatch(/@anonimo\.invalid$/)
    expect(after?.name).toBe('Usuário removido')
    expect(after?.tokenVersion).toBe(1)
    const entry = auditLog.entries[0]
    expect(entry).toMatchObject({ action: 'user.delete', targetId: user.id, result: 'success' })
    expect(JSON.stringify(entry)).not.toContain('fulano')
  })

  it('recusa username que não confere e não altera nada', async () => {
    const { remove, userRepository, user, admin } = await build()
    await expect(remove.execute(admin.id, user.id, 'outro')).rejects.toBeInstanceOf(
      DeleteConfirmationMismatchError,
    )
    expect((await userRepository.findById(user.id))?.email).toBe('fulano@example.com')
  })

  it('recusa excluir administrador', async () => {
    const { remove, admin } = await build()
    await expect(remove.execute(admin.id, admin.id, 'admin')).rejects.toBeInstanceOf(
      AdminAccountProtectedError,
    )
  })
})
