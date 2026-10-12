import type { OptionalEmailCategory } from '../../domain/emailMessage'

export interface UnsubscribeClaim {
  userId: string
  category: OptionalEmailCategory
}

// Token assinado (HMAC) do link de cancelar inscrição: vale sem login e não expira (link de
// e-mail antigo continua cancelando). Só autoriza desligar uma categoria, nada mais.
export interface UnsubscribeTokens {
  issue(claim: UnsubscribeClaim): string
  // `null` para qualquer token que não seja nosso (adulterado, truncado, categoria inválida).
  verify(token: string): UnsubscribeClaim | null
}

// Monta a URL completa do link (a que vai no rodapé e no `List-Unsubscribe`).
export interface UnsubscribeLinks {
  build(claim: UnsubscribeClaim): string
}
