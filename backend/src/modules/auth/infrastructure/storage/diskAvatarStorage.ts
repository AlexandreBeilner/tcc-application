import { randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { AvatarStorage } from '../../application/ports/avatarStorage'

// Tarefa 6.10.8 — arquivo em disco, volume Docker persistente
// (`AVATAR_STORAGE_DIR`, montado em `docker-compose.yml`), servido de volta
// por `express.static` na mesma pasta (composição em `app.ts`). Nome do
// arquivo prefixado por `userId` só por legibilidade em debug/backup — a
// relação real usuário↔arquivo vive em `users.avatar_path`, não no nome.
export function createDiskAvatarStorage(baseDir: string): AvatarStorage {
  return {
    async save(userId, buffer, extension) {
      await mkdir(baseDir, { recursive: true })
      const filename = `${userId}-${randomUUID()}.${extension}`
      await writeFile(path.join(baseDir, filename), buffer)
      return filename
    },

    async delete(avatarPath) {
      await rm(path.join(baseDir, avatarPath), { force: true })
    },
  }
}
