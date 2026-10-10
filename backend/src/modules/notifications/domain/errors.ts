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

// Webhook sem assinatura válida (ou com timestamp velho demais): vira 400 e nada é processado.
export class InvalidWebhookSignatureError extends Error {
  constructor(message = 'assinatura do webhook inválida') {
    super(message)
    this.name = 'InvalidWebhookSignatureError'
  }
}
