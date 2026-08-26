import { describe, expect, it } from 'vitest'
import { InvalidCredentialsError } from '../../domain/errors'
import { createFakePasswordHasher } from '../../test/fakes/fakePasswordHasher'
import { createFakeUserRepository } from '../../test/fakes/fakeUserRepository'
import { ChangePasswordUseCase } from './changePassword'

describe('ChangePasswordUseCase', () => {
  it('troca a senha quando a senha atual está correta', async () => {
    const userRepository = createFakeUserRepository()
    const passwordHasher = createFakePasswordHasher()
    const user = await userRepository.createUser({
      name: 'Alexandre',
      email: 'a@example.com',
      username: 'alexandreb',
      passwordHash: 'hashed:senha-antiga',
    })
    const useCase = new ChangePasswordUseCase(userRepository, passwordHasher)

    await useCase.execute({
      userId: user.id,
      currentPassword: 'senha-antiga',
      newPassword: 'senha-nova',
    })

    const updated = await userRepository.findById(user.id)
    expect(updated?.passwordHash).toBe('hashed:senha-nova')
  })

  it('rejeita e não troca nada quando a senha atual está errada', async () => {
    const userRepository = createFakeUserRepository()
    const passwordHasher = createFakePasswordHasher()
    const user = await userRepository.createUser({
      name: 'Alexandre',
      email: 'a@example.com',
      username: 'alexandreb',
      passwordHash: 'hashed:senha-antiga',
    })
    const useCase = new ChangePasswordUseCase(userRepository, passwordHasher)

    await expect(
      useCase.execute({ userId: user.id, currentPassword: 'errada', newPassword: 'senha-nova' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError)

    const updated = await userRepository.findById(user.id)
    expect(updated?.passwordHash).toBe('hashed:senha-antiga')
  })

  it('rejeita quando a conta tem senha local mas currentPassword não foi informada', async () => {
    const userRepository = createFakeUserRepository()
    const passwordHasher = createFakePasswordHasher()
    const user = await userRepository.createUser({
      name: 'Alexandre',
      email: 'a@example.com',
      username: 'alexandreb',
      passwordHash: 'hashed:senha-antiga',
    })
    const useCase = new ChangePasswordUseCase(userRepository, passwordHasher)

    await expect(
      useCase.execute({ userId: user.id, newPassword: 'senha-nova' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError)
  })

  it('conta só-OAuth (sem senha local) pode setar a primeira senha sem informar currentPassword', async () => {
    const userRepository = createFakeUserRepository()
    const passwordHasher = createFakePasswordHasher()
    const user = await userRepository.createUser({
      name: 'Alexandre',
      email: 'a@example.com',
      username: 'alexandreb',
      passwordHash: null,
    })
    const useCase = new ChangePasswordUseCase(userRepository, passwordHasher)

    await useCase.execute({ userId: user.id, newPassword: 'primeira-senha' })

    const updated = await userRepository.findById(user.id)
    expect(updated?.passwordHash).toBe('hashed:primeira-senha')
  })
})
