import { createFakeAccountMailer } from '../../test/fakes/fakeAccountMailer'
import { describe, expect, it } from 'vitest'
import { UserNotFoundError } from '../../domain/errors'
import { createFakeAvatarStorage } from '../../test/fakes/fakeAvatarStorage'
import { createFakeUserRepository } from '../../test/fakes/fakeUserRepository'
import { AnonymizeAccountUseCase } from './anonymizeAccount'

describe('AnonymizeAccountUseCase', () => {
  it('anonimiza nome/e-mail/username, remove a senha e desconecta identidades OAuth', async () => {
    const userRepository = createFakeUserRepository()
    const { storage: avatarStorage } = createFakeAvatarStorage()
    const user = await userRepository.createUser({
      name: 'Alexandre',
      email: 'a@example.com',
      username: 'alexandreb',
      passwordHash: 'hashed:senha',
    })
    await userRepository.createIdentity({
      userId: user.id,
      providerName: 'google',
      providerAccountId: 'g-123',
    })
    const useCase = new AnonymizeAccountUseCase(
      userRepository,
      avatarStorage,
      createFakeAccountMailer(),
    )

    await useCase.execute({ userId: user.id })

    const updated = await userRepository.findById(user.id)
    expect(updated?.id).toBe(user.id) // mesma linha, não exclusão física
    expect(updated?.name).toBe('Usuário removido')
    expect(updated?.email).not.toBe('a@example.com')
    expect(updated?.username).not.toBe('alexandreb')
    expect(updated?.passwordHash).toBeNull()
    expect(await userRepository.listIdentitiesForUser(user.id)).toEqual([])
  })

  it('remove a foto de perfil salva, sem deixar o arquivo servível após a exclusão', async () => {
    const userRepository = createFakeUserRepository()
    const { storage: avatarStorage, saved, deleted } = createFakeAvatarStorage()
    const user = await userRepository.createUser({
      name: 'Alexandre',
      email: 'a@example.com',
      username: 'alexandreb',
      passwordHash: 'hashed:senha',
    })
    const avatarPath = await avatarStorage.save(user.id, Buffer.from('foto'), 'jpg')
    await userRepository.updateUser(user.id, { avatarPath })
    const useCase = new AnonymizeAccountUseCase(
      userRepository,
      avatarStorage,
      createFakeAccountMailer(),
    )

    await useCase.execute({ userId: user.id })

    const updated = await userRepository.findById(user.id)
    expect(updated?.avatarPath).toBeNull()
    expect(deleted).toEqual([avatarPath])
    expect(saved.has(avatarPath)).toBe(false)
  })

  it('não tenta apagar arquivo nenhum quando o usuário nunca teve avatar', async () => {
    const userRepository = createFakeUserRepository()
    const { storage: avatarStorage, deleted } = createFakeAvatarStorage()
    const user = await userRepository.createUser({
      name: 'Alexandre',
      email: 'a@example.com',
      username: 'alexandreb',
      passwordHash: 'hashed:senha',
    })
    const useCase = new AnonymizeAccountUseCase(
      userRepository,
      avatarStorage,
      createFakeAccountMailer(),
    )

    await useCase.execute({ userId: user.id })

    expect(deleted).toEqual([])
  })

  it('404 pra usuário inexistente', async () => {
    const userRepository = createFakeUserRepository()
    const { storage: avatarStorage } = createFakeAvatarStorage()
    const useCase = new AnonymizeAccountUseCase(
      userRepository,
      avatarStorage,
      createFakeAccountMailer(),
    )

    await expect(useCase.execute({ userId: 'nope' })).rejects.toBeInstanceOf(UserNotFoundError)
  })

  describe('confirmação por e-mail (E7)', () => {
    async function setup() {
      const userRepository = createFakeUserRepository()
      const { storage } = createFakeAvatarStorage()
      const accountMailer = createFakeAccountMailer()
      const user = await userRepository.createUser({
        name: 'Alexandre',
        email: 'a@example.com',
        username: 'alexandreb',
        passwordHash: 'hashed:senha',
      })
      const useCase = new AnonymizeAccountUseCase(userRepository, storage, accountMailer)
      return { userRepository, accountMailer, user, useCase }
    }

    it('confirma ao endereço real, antes de ele virar `.invalid`', async () => {
      const { userRepository, accountMailer, user, useCase } = await setup()

      await useCase.execute({ userId: user.id })

      expect(accountMailer.deletions).toEqual([
        { userId: user.id, to: 'a@example.com', eventId: user.id },
      ])
      expect((await userRepository.findById(user.id))?.email).toMatch(/@anonimo\.invalid$/)
    })

    it('falha ao enfileirar a confirmação não impede a exclusão (LGPD)', async () => {
      const { userRepository, accountMailer, user, useCase } = await setup()
      accountMailer.failWith(new Error('outbox fora do ar'))

      await useCase.execute({ userId: user.id })

      expect((await userRepository.findById(user.id))?.name).toBe('Usuário removido')
    })

    it('usuário inexistente não gera e-mail', async () => {
      const { accountMailer, useCase } = await setup()

      await expect(useCase.execute({ userId: 'nao-existe' })).rejects.toBeInstanceOf(
        UserNotFoundError,
      )

      expect(accountMailer.deletions).toEqual([])
    })
  })
})
