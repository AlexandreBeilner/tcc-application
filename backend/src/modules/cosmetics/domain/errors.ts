// Item inexistente, desativado ou de outro tipo (ex: título no espaço da moldura).
export class CosmeticItemNotFoundError extends Error {
  constructor(message = 'item não encontrado') {
    super(message)
    this.name = 'CosmeticItemNotFoundError'
  }
}
