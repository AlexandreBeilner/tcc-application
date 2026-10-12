import { describe, expect, it } from 'vitest'
import { createFakeAdminSessionAuditor } from '../../test/fakes/fakeAdminSessionAuditor'
import { createFakeAuthEmailTokenRepository } from '../../test/fakes/fakeAuthEmailTokenRepository'
import { createFakeAuthMailer } from '../../test/fakes/fakeAuthMailer'
import { createFakeEmailTokenGenerator } from '../../test/fakes/fakeEmailTokenGenerator'
import { createFakeUserRepository } from '../../test/fakes/fakeUserRepository'
import { RequestPasswordResetUseCase } from './requestPasswordReset'

const NOW = new Date('2026-10-10T12:00:00Z')

function setup() {
  const userRepository = createFakeUserRepository()
  const tokens = createFakeAuthEmailTokenRepository()
  const mailer = createFakeAuthMailer()
  const auditor = createFakeAdminSessionAuditor()
  const useCase = new RequestPasswordResetUseCase(
    userRepository,
    tokens,
    createFakeEmailTokenGenerator(),
    mailer,
    auditor,
    () => NOW,
  )
  return { userRepository, tokens, mailer, auditor, useCase }
}

describe('RequestPasswordResetUseCase', () => {
  it('grava só o hash, vale 30 minutos e enfileira o e-mail com o token em claro', async () => {
    const { userRepository, tokens, mailer, useCase } = setup()
    const user = await userRepository.createUser({
      name: 'Ana',
      email: 'ana@exemplo.com',
      username: 'ana',
      passwordHash: 'hashed:antiga',
    })

    await useCase.execute({ email: 'ana@exemplo.com' })

    expect(tokens.rows).toHaveLength(1)
    expect(tokens.rows[0]).toMatchObject({
      userId: user.id,
      kind: 'password_reset',
      tokenHash: 'hash:token-1',
      expiresAt: new Date('2026-10-10T12:30:00Z'),
    })
    expect(mailer.resets).toEqual([
      expect.objectContaining({
        userId: user.id,
        to: 'ana@exemplo.com',
        name: 'Ana',
        token: 'token-1',
        tokenId: tokens.rows[0].id,
      }),
    ])
  })

  it('e-mail inexistente: não grava nada nem envia, e não falha', async () => {
    const { tokens, mailer, useCase } = setup()

    await expect(useCase.execute({ email: 'ninguem@exemplo.com' })).resolves.toBeUndefined()

    expect(tokens.rows).toHaveLength(0)
    expect(mailer.resets).toHaveLength(0)
  })

  it('conta só-Google recebe o mesmo e-mail de reset (cria a primeira senha)', async () => {
    const { userRepository, mailer, useCase } = setup()
    await userRepository.createUser({
      name: 'Gil',
      email: 'gil@exemplo.com',
      username: 'gil',
      passwordHash: null,
    })

    await useCase.execute({ email: 'gil@exemplo.com' })

    expect(mailer.resets).toHaveLength(1)
  })

  it('um novo pedido invalida o link anterior', async () => {
    const { userRepository, tokens, useCase } = setup()
    await userRepository.createUser({
      name: 'Ana',
      email: 'ana@exemplo.com',
      username: 'ana',
      passwordHash: 'hashed:antiga',
    })

    await useCase.execute({ email: 'ana@exemplo.com' })
    await useCase.execute({ email: 'ana@exemplo.com' })

    expect(tokens.rows.map((r) => r.usedAt !== null)).toEqual([true, false])
  })

  it('admin: nada é enviado e a tentativa vai para a auditoria (D7)', async () => {
    const { userRepository, tokens, mailer, auditor, useCase } = setup()
    const admin = await userRepository.createUser({
      name: 'Admin',
      email: 'admin@exemplo.com',
      username: 'admin',
      passwordHash: 'hashed:x',
      role: 'admin',
    })

    await useCase.execute({ email: 'admin@exemplo.com' })

    expect(tokens.rows).toHaveLength(0)
    expect(mailer.resets).toHaveLength(0)
    expect(auditor.events).toEqual([{ adminId: admin.id, kind: 'password_reset_denied' }])
  })
})
