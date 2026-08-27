import { describe, expect, it } from 'vitest'
import {
  EmailAlreadyInUseError,
  UsernameAlreadyInUseError,
  UserNotFoundError,
} from '../../domain/errors'
import { createFakeUserRepository } from '../../test/fakes/fakeUserRepository'
import { UpdateProfileUseCase } from './updateProfile'

async function seedUser(
  userRepository: ReturnType<typeof createFakeUserRepository>,
  overrides: Partial<{ name: string; email: string; username: string }> = {},
) {
  return userRepository.createUser({
    name: overrides.name ?? 'Alexandre',
    email: overrides.email ?? 'alexandre@example.com',
    username: overrides.username ?? 'alexandreb',
    passwordHash: 'hashed:senha',
  })
}

describe('UpdateProfileUseCase', () => {
  it('atualiza nome/e-mail/username', async () => {
    const userRepository = createFakeUserRepository()
    const user = await seedUser(userRepository)
    const useCase = new UpdateProfileUseCase(userRepository)

    const updated = await useCase.execute({
      userId: user.id,
      name: 'Alexandre Beilner',
      email: 'novo@example.com',
      username: 'novousername',
    })

    expect(updated.name).toBe('Alexandre Beilner')
    expect(updated.email).toBe('novo@example.com')
    expect(updated.username).toBe('novousername')
  })

  it('permite reenviar o mesmo e-mail/username já em uso pelo próprio usuário', async () => {
    const userRepository = createFakeUserRepository()
    const user = await seedUser(userRepository)
    const useCase = new UpdateProfileUseCase(userRepository)

    const updated = await useCase.execute({
      userId: user.id,
      email: user.email,
      username: user.username,
    })

    expect(updated.email).toBe(user.email)
  })

  it('rejeita e-mail já em uso por outro usuário (409)', async () => {
    const userRepository = createFakeUserRepository()
    const user = await seedUser(userRepository)
    await seedUser(userRepository, { email: 'outro@example.com', username: 'outrousername' })
    const useCase = new UpdateProfileUseCase(userRepository)

    await expect(
      useCase.execute({ userId: user.id, email: 'outro@example.com' }),
    ).rejects.toBeInstanceOf(EmailAlreadyInUseError)
  })

  it('rejeita username já em uso por outro usuário (409)', async () => {
    const userRepository = createFakeUserRepository()
    const user = await seedUser(userRepository)
    await seedUser(userRepository, { email: 'outro@example.com', username: 'outrousername' })
    const useCase = new UpdateProfileUseCase(userRepository)

    await expect(
      useCase.execute({ userId: user.id, username: 'outrousername' }),
    ).rejects.toBeInstanceOf(UsernameAlreadyInUseError)
  })

  it('marca onboardingCompleted', async () => {
    const userRepository = createFakeUserRepository()
    const user = await seedUser(userRepository)
    expect(user.onboardingCompleted).toBe(false)
    const useCase = new UpdateProfileUseCase(userRepository)

    const updated = await useCase.execute({ userId: user.id, onboardingCompleted: true })

    expect(updated.onboardingCompleted).toBe(true)
  })

  it('404 pra usuário inexistente', async () => {
    const userRepository = createFakeUserRepository()
    const useCase = new UpdateProfileUseCase(userRepository)

    await expect(useCase.execute({ userId: 'nope', name: 'x' })).rejects.toBeInstanceOf(
      UserNotFoundError,
    )
  })
})
