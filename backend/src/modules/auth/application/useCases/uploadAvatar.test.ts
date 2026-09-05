import { describe, expect, it } from 'vitest'
import { InvalidAvatarFileError, UserNotFoundError } from '../../domain/errors'
import { createFakeAvatarStorage } from '../../test/fakes/fakeAvatarStorage'
import { createFakeUserRepository } from '../../test/fakes/fakeUserRepository'
import { MAX_AVATAR_SIZE_BYTES, UploadAvatarUseCase } from './uploadAvatar'

async function createUser(userRepository: ReturnType<typeof createFakeUserRepository>) {
  return userRepository.createUser({
    name: 'Alexandre',
    email: 'a@example.com',
    username: 'alexandreb',
    passwordHash: 'hashed:senha',
  })
}

describe('UploadAvatarUseCase', () => {
  it('salva o arquivo, persiste o caminho e devolve o usuário atualizado', async () => {
    const userRepository = createFakeUserRepository()
    const { storage, saved } = createFakeAvatarStorage()
    const user = await createUser(userRepository)
    const useCase = new UploadAvatarUseCase(userRepository, storage)

    const updated = await useCase.execute({
      userId: user.id,
      buffer: Buffer.from('fake-jpeg'),
      mimeType: 'image/jpeg',
      sizeBytes: 9,
    })

    expect(updated.avatarPath).toMatch(new RegExp(`^${user.id}-.+\\.jpg$`))
    expect(saved.has(updated.avatarPath as string)).toBe(true)
  })

  it('rejeita tipo de arquivo fora da lista permitida', async () => {
    const userRepository = createFakeUserRepository()
    const { storage } = createFakeAvatarStorage()
    const user = await createUser(userRepository)
    const useCase = new UploadAvatarUseCase(userRepository, storage)

    await expect(
      useCase.execute({
        userId: user.id,
        buffer: Buffer.from('x'),
        mimeType: 'image/gif',
        sizeBytes: 1,
      }),
    ).rejects.toBeInstanceOf(InvalidAvatarFileError)

    const unchanged = await userRepository.findById(user.id)
    expect(unchanged?.avatarPath).toBeNull()
  })

  it('rejeita arquivo maior que o limite', async () => {
    const userRepository = createFakeUserRepository()
    const { storage } = createFakeAvatarStorage()
    const user = await createUser(userRepository)
    const useCase = new UploadAvatarUseCase(userRepository, storage)

    await expect(
      useCase.execute({
        userId: user.id,
        buffer: Buffer.from('x'),
        mimeType: 'image/png',
        sizeBytes: MAX_AVATAR_SIZE_BYTES + 1,
      }),
    ).rejects.toBeInstanceOf(InvalidAvatarFileError)
  })

  it('apaga o arquivo anterior depois de trocar por um novo', async () => {
    const userRepository = createFakeUserRepository()
    const { storage, deleted } = createFakeAvatarStorage()
    const user = await createUser(userRepository)
    const useCase = new UploadAvatarUseCase(userRepository, storage)

    const first = await useCase.execute({
      userId: user.id,
      buffer: Buffer.from('primeiro'),
      mimeType: 'image/png',
      sizeBytes: 8,
    })

    await useCase.execute({
      userId: user.id,
      buffer: Buffer.from('segundo'),
      mimeType: 'image/webp',
      sizeBytes: 7,
    })

    expect(deleted).toContain(first.avatarPath)
  })

  it('rejeita usuário inexistente', async () => {
    const userRepository = createFakeUserRepository()
    const { storage } = createFakeAvatarStorage()
    const useCase = new UploadAvatarUseCase(userRepository, storage)

    await expect(
      useCase.execute({
        userId: 'inexistente',
        buffer: Buffer.from('x'),
        mimeType: 'image/png',
        sizeBytes: 1,
      }),
    ).rejects.toBeInstanceOf(UserNotFoundError)
  })
})
