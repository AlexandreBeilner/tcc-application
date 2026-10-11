// Item que depende de indicações válidas que a pessoa ainda não tem (MO.7.2).
export class CosmeticLockedError extends Error {
  constructor(message = 'item ainda bloqueado') {
    super(message)
    this.name = 'CosmeticLockedError'
  }
}

// Item inexistente, desativado ou de outro tipo (ex: título no espaço da moldura).
export class CosmeticItemNotFoundError extends Error {
  constructor(message = 'item não encontrado') {
    super(message)
    this.name = 'CosmeticItemNotFoundError'
  }
}
