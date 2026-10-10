// Lançado pelo adapter do provedor (`EmailSender`). `permanent` separa "não adianta tentar de
// novo" (endereço inválido, 4xx) de "tente depois" (429, 5xx, timeout): o worker só reagenda o
// segundo caso.
export class EmailSendError extends Error {
  constructor(
    message: string,
    readonly permanent: boolean,
  ) {
    super(message)
    this.name = 'EmailSendError'
  }
}
