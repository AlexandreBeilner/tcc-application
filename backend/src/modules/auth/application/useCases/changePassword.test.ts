import { describe, expect, it } from 'vitest'
import { InvalidCredentialsError } from '../../domain/errors'
import { createFakeAuthMailer } from '../../test/fakes/fakeAuthMailer'
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
    const useCase = new ChangePasswordUseCase(
      userRepository,
      passwordHasher,
      createFakeAuthMailer(),
    )

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
    const useCase = new ChangePasswordUseCase(
      userRepository,
      passwordHasher,
      createFakeAuthMailer(),
    )

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
    const useCase = new ChangePasswordUseCase(
      userRepository,
      passwordHasher,
      createFakeAuthMailer(),
    )

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
    const useCase = new ChangePasswordUseCase(
      userRepository,
      passwordHasher,
      createFakeAuthMailer(),
    )

    await useCase.execute({ userId: user.id, newPassword: 'primeira-senha' })

    const updated = await userRepository.findById(user.id)
    expect(updated?.passwordHash).toBe('hashed:primeira-senha')
  })

  describe('aviso por e-mail (E4)', () => {
    async function setup(opts: { failMailer?: boolean } = {}) {
      const userRepository = createFakeUserRepository()
      const mailer = createFakeAuthMailer()
      if (opts.failMailer) {
        mailer.sendPasswordChanged = async () => {
          throw new Error('outbox fora do ar')
        }
      }
      let seq = 0
      const useCase = new ChangePasswordUseCase(
        userRepository,
        createFakePasswordHasher(),
        mailer,
        () => `evento-${++seq}`,
      )
      const user = await userRepository.createUser({
        name: 'Alexandre',
        email: 'a@example.com',
        username: 'alexandreb',
        passwordHash: 'hashed:senha-antiga',
      })
      return { userRepository, mailer, useCase, user }
    }

    it('enfileira um aviso por troca, sem dizer que as sessões foram encerradas', async () => {
      const { mailer, useCase, user } = await setup()

      await useCase.execute({
        userId: user.id,
        currentPassword: 'senha-antiga',
        newPassword: 'nova-1',
      })
      await useCase.execute({ userId: user.id, currentPassword: 'nova-1', newPassword: 'nova-2' })

      expect(mailer.changes).toEqual([
        {
          userId: user.id,
          to: 'a@example.com',
          name: 'Alexandre',
          eventId: 'evento-1',
          sessionsEnded: false,
        },
        {
          userId: user.id,
          to: 'a@example.com',
          name: 'Alexandre',
          eventId: 'evento-2',
          sessionsEnded: false,
        },
      ])
    })

    it('senha atual errada não avisa ninguém', async () => {
      const { mailer, useCase, user } = await setup()

      await expect(
        useCase.execute({ userId: user.id, currentPassword: 'errada', newPassword: 'nova-1' }),
      ).rejects.toBeInstanceOf(InvalidCredentialsError)

      expect(mailer.changes).toEqual([])
    })

    it('falha ao enfileirar o aviso não desfaz a troca', async () => {
      const { userRepository, useCase, user } = await setup({ failMailer: true })

      await useCase.execute({
        userId: user.id,
        currentPassword: 'senha-antiga',
        newPassword: 'nova-1',
      })

      expect((await userRepository.findById(user.id))?.passwordHash).toBe('hashed:nova-1')
    })
  })
})
