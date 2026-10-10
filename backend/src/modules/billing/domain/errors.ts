// Lançado por qualquer caso de uso de feature PRO quando a pessoa não tem plano ativo. Vira
// `403 { error: 'requer plano PRO' }` no `jsonErrorHandler` (reconhecido pelo `code`, pra o handler
// compartilhado não importar este módulo). Nunca 404: a feature existe, só está bloqueada.
export class ProRequiredError extends Error {
  readonly code = 'PRO_REQUIRED'
  constructor(message = 'requer plano PRO') {
    super(message)
    this.name = 'ProRequiredError'
  }
}

// Billing desligado por configuração (`BILLING_PROVIDER=disabled`) e alguém tentou falar com o
// provedor.
export class BillingDisabledError extends Error {
  constructor(message = 'cobrança desligada neste ambiente') {
    super(message)
    this.name = 'BillingDisabledError'
  }
}

// Falha ao consultar o provedor (rede, 5xx, resposta fora do formato). O webhook responde 5xx pra
// o RevenueCat reenviar.
export class BillingProviderError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BillingProviderError'
  }
}
