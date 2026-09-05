import { randomUUID } from 'node:crypto'
import type { AvatarStorage } from '../../application/ports/avatarStorage'

export function createFakeAvatarStorage(): {
  storage: AvatarStorage
  saved: Map<string, Buffer>
  deleted: string[]
} {
  const saved = new Map<string, Buffer>()
  const deleted: string[] = []

  const storage: AvatarStorage = {
    async save(userId, buffer, extension) {
      const path = `${userId}-${randomUUID()}.${extension}`
      saved.set(path, buffer)
      return path
    },
    async delete(path) {
      saved.delete(path)
      deleted.push(path)
    },
  }

  return { storage, saved, deleted }
}
