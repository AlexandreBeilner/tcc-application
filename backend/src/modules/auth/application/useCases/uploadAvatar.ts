import { InvalidAvatarFileError, UserNotFoundError } from '../../domain/errors'
import type { User } from '../../domain/user'
import type { AvatarStorage } from '../ports/avatarStorage'
import type { UserRepository } from '../ports/userRepository'

// Tela 9.2 (tarefa 6.10.8) — arquivo salvo em disco (volume Docker
// persistente do backend), só o caminho relativo em `users.avatar_path`,
// nunca base64 numa coluna. Tipo/tamanho validados aqui (regra de negócio,
// não HTTP) mesmo com `multer` já limitando `fileSize` no router — defesa
// em profundidade, e o teste de use case não depende de multipart/Express.
export const ALLOWED_AVATAR_MIME_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024

export interface UploadAvatarInput {
  userId: string
  buffer: Buffer
  mimeType: string
  sizeBytes: number
}

export class UploadAvatarUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly avatarStorage: AvatarStorage,
  ) {}

  async execute(input: UploadAvatarInput): Promise<User> {
    const current = await this.userRepository.findById(input.userId)
    if (!current) {
      throw new UserNotFoundError('usuário não encontrado')
    }

    const extension = ALLOWED_AVATAR_MIME_TYPES[input.mimeType]
    if (!extension) {
      throw new InvalidAvatarFileError('tipo de arquivo não suportado (use JPEG, PNG ou WEBP)')
    }
    if (input.sizeBytes > MAX_AVATAR_SIZE_BYTES) {
      throw new InvalidAvatarFileError('arquivo maior que o limite de 5MB')
    }

    const previousPath = current.avatarPath
    const newPath = await this.avatarStorage.save(input.userId, input.buffer, extension)
    const updated = await this.userRepository.updateUser(input.userId, { avatarPath: newPath })

    // Só depois de confirmar a troca no banco — nunca apagar o arquivo
    // antigo antes do novo estar persistido (evita um usuário sem avatar
    // nenhum se `updateUser` falhar entre os dois passos).
    if (previousPath) {
      await this.avatarStorage.delete(previousPath)
    }

    return updated
  }
}
