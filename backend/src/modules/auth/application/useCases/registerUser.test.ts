import { describe, expect, it } from 'vitest'
import { EmailAlreadyInUseError, UsernameAlreadyInUseError } from '../../domain/errors'
import { createFakePasswordHasher } from '../../test/fakes/fakePasswordHasher'
import { createFakeTokenIssuer } from '../../test/fakes/fakeTokenIssuer'
import { createFakeUserRepository } from '../../test/fakes/fakeUserRepository'
import { RegisterUserUseCase } from './registerUser'

function build() {
  const userRepository = createFakeUserRepository()
  const useCase = new RegisterUserUseCase(
    userRepository,
    createFakePasswordHasher(),
    createFakeTokenIssuer(),
  )
  return { userRepository, useCase }
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
    expect(result.token).toBe(`fake-token:${result.user.id}:user`)
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
