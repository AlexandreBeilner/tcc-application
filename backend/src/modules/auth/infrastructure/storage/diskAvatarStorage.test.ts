import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDiskAvatarStorage } from './diskAvatarStorage'

describe('createDiskAvatarStorage', () => {
  let baseDir: string

  beforeEach(async () => {
    baseDir = await mkdtemp(path.join(tmpdir(), 'avatar-test-'))
  })

  afterEach(async () => {
    await rm(baseDir, { recursive: true, force: true })
  })

  it('escreve o buffer em disco e devolve um nome de arquivo com a extensão certa', async () => {
    const storage = createDiskAvatarStorage(baseDir)

    const filename = await storage.save('u1', Buffer.from('conteudo-fake'), 'jpg')

    expect(filename).toMatch(/^u1-.+\.jpg$/)
    const written = await readFile(path.join(baseDir, filename))
    expect(written.toString()).toBe('conteudo-fake')
  })

  it('apaga um arquivo existente', async () => {
    const storage = createDiskAvatarStorage(baseDir)
    const filename = await storage.save('u1', Buffer.from('x'), 'png')

    await storage.delete(filename)

    await expect(readFile(path.join(baseDir, filename))).rejects.toThrow()
  })

  it('apagar um arquivo inexistente não lança erro', async () => {
    const storage = createDiskAvatarStorage(baseDir)

    await expect(storage.delete('nao-existe.png')).resolves.toBeUndefined()
  })

  it('cria o diretório base se ainda não existir', async () => {
    const nestedDir = path.join(baseDir, 'nested', 'avatars')
    const storage = createDiskAvatarStorage(nestedDir)

    const filename = await storage.save('u1', Buffer.from('x'), 'webp')

    const written = await readFile(path.join(nestedDir, filename))
    expect(written.toString()).toBe('x')
  })
})
