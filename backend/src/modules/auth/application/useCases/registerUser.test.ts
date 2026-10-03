import { describe, expect, it } from 'vitest'
import { EmailAlreadyInUseError, UsernameAlreadyInUseError } from '../../domain/errors'
import { createFakeAccountProvisioner } from '../../test/fakes/fakeAccountProvisioner'
import { createFakePasswordHasher } from '../../test/fakes/fakePasswordHasher'
import { createFakeTokenIssuer } from '../../test/fakes/fakeTokenIssuer'
import { createFakeUserRepository } from '../../test/fakes/fakeUserRepository'
import { RegisterUserUseCase } from './registerUser'

function build() {
  const userRepository = createFakeUserRepository()
  const accountProvisioner = createFakeAccountProvisioner()
  const useCase = new RegisterUserUseCase(
    userRepository,
    createFakePasswordHasher(),
    createFakeTokenIssuer(),
    accountProvisioner,
  )
  return { userRepository, accountProvisioner, useCase }
}

describe('RegisterUserUseCase', () => {
  it('cria usuário comum, faz hash da senha e emite token', async () => {
    const { useCase } = build()

    const result = await useCase.execute({
      name: 'Alexandre',
      email: 'alexandre@example.com',
      username: 'alexandreb',
      password: 'senha-forte-123',
    })

    expect(result.user.role).toBe('user')
    expect(result.user.passwordHash).toBe('hashed:senha-forte-123')
    expect(result.token).toMatch(new RegExp(`^fake-token:${result.user.id}:user:\\d+$`))
  })

  it('abre conta no motor de simulação com capital inicial padronizado (RNF06)', async () => {
    const { accountProvisioner, useCase } = build()

    const result = await useCase.execute({
      name: 'Alexandre',
      email: 'alexandre@example.com',
      username: 'alexandreb',
      password: 'senha-forte-123',
    })

    expect(accountProvisioner.provisionedUserIds).toEqual([result.user.id])
  })

  it('rejeita e-mail já cadastrado', async () => {
    const { useCase } = build()
    await useCase.execute({
      name: 'A',
      email: 'dup@example.com',
      username: 'a1',
      password: 'senha-forte-123',
    })

    await expect(
      useCase.execute({
        name: 'B',
        email: 'dup@example.com',
        username: 'a2',
        password: 'senha-forte-123',
      }),
    ).rejects.toBeInstanceOf(EmailAlreadyInUseError)
  })

  it('rejeita username já em uso', async () => {
    const { useCase } = build()
    await useCase.execute({
      name: 'A',
      email: 'a@example.com',
      username: 'dup',
      password: 'senha-forte-123',
    })

    await expect(
      useCase.execute({
        name: 'B',
        email: 'b@example.com',
        username: 'dup',
        password: 'senha-forte-123',
      }),
    ).rejects.toBeInstanceOf(UsernameAlreadyInUseError)
  })
})
