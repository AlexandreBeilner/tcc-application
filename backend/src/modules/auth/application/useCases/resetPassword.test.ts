import { describe, expect, it } from 'vitest'
import { InvalidEmailTokenError } from '../../domain/errors'
import { createFakeAuthEmailTokenRepository } from '../../test/fakes/fakeAuthEmailTokenRepository'
import { createFakeAuthMailer } from '../../test/fakes/fakeAuthMailer'
import { createFakeEmailTokenGenerator } from '../../test/fakes/fakeEmailTokenGenerator'
import { createFakePasswordHasher } from '../../test/fakes/fakePasswordHasher'
import { createFakeUserRepository } from '../../test/fakes/fakeUserRepository'
import { ResetPasswordUseCase } from './resetPassword'

const NOW = new Date('2026-10-10T12:00:00Z')

async function setup(options: { passwordHash?: string | null; role?: 'user' | 'admin' } = {}) {
  const userRepository = createFakeUserRepository()
  const tokens = createFakeAuthEmailTokenRepository()
  const mailer = createFakeAuthMailer()
  const generator = createFakeEmailTokenGenerator()
  let now = NOW
  const useCase = new ResetPasswordUseCase(
    userRepository,
    tokens,
    generator,
    createFakePasswordHasher(),
    mailer,
    () => now,
  )
  const user = await userRepository.createUser({
    name: 'Ana',
    email: 'ana@exemplo.com',
    username: 'ana',
    passwordHash: options.passwordHash === undefined ? 'hashed:antiga' : options.passwordHash,
    role: options.role,
  })
  const { token, tokenHash } = generator.generate()
  await tokens.replaceActive(
    {
      userId: user.id,
      kind: 'password_reset',
      tokenHash,
      expiresAt: new Date(NOW.getTime() + 30 * 60_000),
    },
    NOW,
  )
  return {
    userRepository,
    tokens,
    mailer,
    useCase,
    user,
    token,
    advance: (ms: number) => {
      now = new Date(now.getTime() + ms)
    },
  }
}

describe('ResetPasswordUseCase', () => {
  it('grava a senha nova, encerra as sessões e avisa por e-mail', async () => {
    const { userRepository, mailer, useCase, user, token, tokens } = await setup()

    await useCase.execute({ token, newPassword: 'senha-nova-123' })

    const updated = await userRepository.findById(user.id)
    expect(updated?.passwordHash).toBe('hashed:senha-nova-123')
    expect(updated?.tokenVersion).toBe(1)
    expect(mailer.changes).toEqual([
      expect.objectContaining({
        userId: user.id,
        to: 'ana@exemplo.com',
        eventId: tokens.rows[0].id,
        sessionsEnded: true,
      }),
    ])
  })

  it('marca o e-mail como verificado: quem leu o link provou controlar a caixa', async () => {
    const { userRepository, useCase, user, token } = await setup()
    expect(user.emailVerifiedAt).toBeNull()

    await useCase.execute({ token, newPassword: 'senha-nova-123' })

    expect((await userRepository.findById(user.id))?.emailVerifiedAt).toEqual(NOW)
  })

  it('conta só-Google cria a primeira senha (D4)', async () => {
    const { userRepository, useCase, user, token } = await setup({ passwordHash: null })

    await useCase.execute({ token, newPassword: 'primeira-senha' })

    expect((await userRepository.findById(user.id))?.passwordHash).toBe('hashed:primeira-senha')
  })

  it('recusa token desconhecido', async () => {
    const { useCase } = await setup()

    await expect(
      useCase.execute({ token: 'qualquer', newPassword: 'senha-nova-123' }),
    ).rejects.toMatchObject({ reason: 'invalid' })
  })

  it('recusa token expirado e não troca a senha', async () => {
    const { userRepository, useCase, user, token, advance } = await setup()
    advance(31 * 60_000)

    await expect(useCase.execute({ token, newPassword: 'senha-nova-123' })).rejects.toMatchObject({
      reason: 'expired',
    })
    expect((await userRepository.findById(user.id))?.passwordHash).toBe('hashed:antiga')
  })

  it('recusa token já usado: o link só funciona uma vez', async () => {
    const { useCase, token } = await setup()
    await useCase.execute({ token, newPassword: 'senha-nova-123' })

    await expect(useCase.execute({ token, newPassword: 'outra-senha-1' })).rejects.toMatchObject({
      reason: 'used',
    })
  })

  it('recusa token de conta admin (D7)', async () => {
    const { useCase, token } = await setup({ role: 'admin' })

    await expect(useCase.execute({ token, newPassword: 'senha-nova-123' })).rejects.toBeInstanceOf(
      InvalidEmailTokenError,
    )
  })

  it('falha ao enfileirar o aviso não desfaz o reset', async () => {
    const { userRepository, mailer, useCase, user, token } = await setup()
    mailer.sendPasswordChanged = async () => {
      throw new Error('outbox fora')
    }

    await expect(useCase.execute({ token, newPassword: 'senha-nova-123' })).resolves.toBeUndefined()
    expect((await userRepository.findById(user.id))?.passwordHash).toBe('hashed:senha-nova-123')
  })
})
