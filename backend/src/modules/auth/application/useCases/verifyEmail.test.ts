import { createFakeAccountMailer } from '../../test/fakes/fakeAccountMailer'
import { describe, expect, it } from 'vitest'
import { InvalidEmailTokenError } from '../../domain/errors'
import { createFakeAuthEmailTokenRepository } from '../../test/fakes/fakeAuthEmailTokenRepository'
import { createFakeEmailTokenGenerator } from '../../test/fakes/fakeEmailTokenGenerator'
import { createFakeUserRepository } from '../../test/fakes/fakeUserRepository'
import { VerifyEmailUseCase } from './verifyEmail'

const NOW = new Date('2026-10-10T12:00:00Z')

async function setup() {
  const userRepository = createFakeUserRepository()
  const tokens = createFakeAuthEmailTokenRepository()
  const generator = createFakeEmailTokenGenerator()
  const accountMailer = createFakeAccountMailer()
  const useCase = new VerifyEmailUseCase(
    userRepository,
    tokens,
    generator,
    accountMailer,
    () => NOW,
  )
  const user = await userRepository.createUser({
    name: 'Ana',
    email: 'ana@exemplo.com',
    username: 'ana',
    passwordHash: 'hashed:x',
  })
  const { token, tokenHash } = generator.generate()
  await tokens.replaceActive(
    {
      userId: user.id,
      kind: 'email_verification',
      tokenHash,
      expiresAt: new Date(NOW.getTime() + 24 * 60 * 60_000),
    },
    NOW,
  )
  return { userRepository, tokens, useCase, user, token, accountMailer }
}

describe('VerifyEmailUseCase', () => {
  it('marca o e-mail como verificado e gasta o token', async () => {
    const { userRepository, tokens, useCase, user, token } = await setup()

    await useCase.execute({ token })

    expect((await userRepository.findById(user.id))?.emailVerifiedAt).toEqual(NOW)
    expect(tokens.rows[0].usedAt).toEqual(NOW)
  })

  it('envia as boas-vindas (E5) só na primeira verificação', async () => {
    const { useCase, user, token, accountMailer } = await setup()

    await useCase.execute({ token })

    expect(accountMailer.welcomes).toEqual([
      { userId: user.id, to: 'ana@exemplo.com', name: 'Ana' },
    ])
  })

  it('falha ao enfileirar as boas-vindas não desfaz a verificação', async () => {
    const { userRepository, useCase, user, token, accountMailer } = await setup()
    accountMailer.failWith(new Error('outbox fora do ar'))

    await useCase.execute({ token })

    expect((await userRepository.findById(user.id))?.emailVerifiedAt).toEqual(NOW)
  })

  it('token desconhecido é recusado como invalid', async () => {
    const { useCase } = await setup()
    await expect(useCase.execute({ token: 'nao-existe' })).rejects.toMatchObject({
      reason: 'invalid',
    })
  })

  it('token já usado é recusado como used', async () => {
    const { useCase, token } = await setup()
    await useCase.execute({ token })
    await expect(useCase.execute({ token })).rejects.toMatchObject({ reason: 'used' })
  })

  it('token vencido é recusado como expired e não verifica a conta', async () => {
    const { userRepository, tokens, useCase, user, token } = await setup()
    tokens.rows[0].expiresAt = new Date(NOW.getTime() - 1)

    await expect(useCase.execute({ token })).rejects.toBeInstanceOf(InvalidEmailTokenError)
    await expect(useCase.execute({ token })).rejects.toMatchObject({ reason: 'expired' })
    expect((await userRepository.findById(user.id))?.emailVerifiedAt).toBeNull()
  })

  it('token de reset de senha não serve para verificar e-mail', async () => {
    const { tokens, useCase, token } = await setup()
    tokens.rows[0].kind = 'password_reset'
    await expect(useCase.execute({ token })).rejects.toMatchObject({ reason: 'invalid' })
  })

  it('conta já verificada não recebe boas-vindas de novo', async () => {
    const { userRepository, useCase, user, token, accountMailer } = await setup()
    await userRepository.updateUser(user.id, { emailVerifiedAt: new Date('2026-01-01') })

    await useCase.execute({ token })

    expect(accountMailer.welcomes).toEqual([])
  })

  it('não regrava a data de uma conta que já estava verificada', async () => {
    const { userRepository, useCase, user, token } = await setup()
    const earlier = new Date('2026-01-01T00:00:00Z')
    await userRepository.updateUser(user.id, { emailVerifiedAt: earlier })

    await useCase.execute({ token })

    expect((await userRepository.findById(user.id))?.emailVerifiedAt).toEqual(earlier)
  })
})
