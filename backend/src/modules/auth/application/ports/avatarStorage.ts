// Tarefa 6.10.8 — port própria do módulo (mesmo raciocínio de `userRepository`
// vs. `friendshipRepository`, cada módulo com a sua). O adapter concreto
// (`infrastructure/storage/diskAvatarStorage.ts`) escreve num volume Docker
// persistente; a interface só conhece "salvar bytes, devolver o nome do
// arquivo" — sem caminho absoluto de disco vazando pra application/domain.
export interface AvatarStorage {
  // `extension` já validada pelo use case (ver ALLOWED_AVATAR_MIME_TYPES em
  // uploadAvatar.ts) — o adapter só monta o nome do arquivo.
  save(userId: string, buffer: Buffer, extension: string): Promise<string>
  // Idempotente: apagar um arquivo que não existe mais não é erro (evita
  // acoplar UploadAvatarUseCase a checar existência antes de trocar).
  delete(path: string): Promise<void>
}
