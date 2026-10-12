import { describe, expect, it } from 'vitest'
import { EMAIL_TOKEN_TTL_MS } from '../../domain/emailToken'
import { createFakeAuthEmailTokenRepository } from '../../test/fakes/fakeAuthEmailTokenRepository'
import { createFakeAuthMailer } from '../../test/fakes/fakeAuthMailer'
import { createFakeEmailTokenGenerator } from '../../test/fakes/fakeEmailTokenGenerator'
import { createFakeUserRepository } from '../../test/fakes/fakeUserRepository'
import { SendEmailVerificationUseCase } from './sendEmailVerification'

const NOW = new Date('2026-10-10T12:00:00Z')

async function setup() {
  const userRepository = createFakeUserRepository()
  const tokens = createFakeAuthEmailTokenRepository()
  const mailer = createFakeAuthMailer()
  const useCase = new SendEmailVerificationUseCase(
    userRepository,
    tokens,
    createFakeEmailTokenGenerator(),
    mailer,
    () => NOW,
  )
  const user = await userRepository.createUser({
    name: 'Ana',
    email: 'ana@exemplo.com',
    username: 'ana',
    passwordHash: 'hashed:x',
  })
  return { userRepository, tokens, mailer, useCase, user }
}

describe('SendEmailVerificationUseCase', () => {
  it('grava o token de 24 h e enfileira o e-mail com o token em claro', async () => {
    const { tokens, mailer, useCase, user } = await setup()

    await useCase.execute({ email: 'ana@exemplo.com' })

    expect(tokens.rows).toHaveLength(1)
    expect(tokens.rows[0]).toMatchObject({ userId: user.id, kind: 'email_verification' })
    expect(tokens.rows[0].expiresAt.getTime()).toBe(
      NOW.getTime() + EMAIL_TOKEN_TTL_MS.email_verification,
    )
    expect(mailer.verifications).toHaveLength(1)
    expect(mailer.verifications[0]).toMatchObject({ to: 'ana@exemplo.com', token: 'token-1' })
    expect(tokens.rows[0].tokenHash).toBe('hash:token-1')
  })

  it('pedir de novo anula o link anterior', async () => {
    const { tokens, useCase } = await setup()

    await useCase.execute({ email: 'ana@exemplo.com' })
    await useCase.execute({ email: 'ana@exemplo.com' })

    expect(tokens.rows.map((row) => row.usedAt !== null)).toEqual([true, false])
  })

  it('não envia nada (e não vaza) para e-mail desconhecido, conta já verificada ou suspensa', async () => {
    const { userRepository, mailer, tokens, useCase, user } = await setup()

    await useCase.execute({ email: 'ninguem@exemplo.com' })
    await userRepository.updateUser(user.id, { emailVerifiedAt: NOW })
    await useCase.execute({ email: 'ana@exemplo.com' })
    await userRepository.updateUser(user.id, { emailVerifiedAt: null, status: 'suspended' })
    await useCase.execute({ email: 'ana@exemplo.com' })

    expect(mailer.verifications).toHaveLength(0)
    expect(tokens.rows).toHaveLength(0)
  })
})
