import type { RenderedEmail } from '../../domain/emailMessage'

// Monta assunto/HTML/texto a partir da chave do template e do payload do outbox. A
// implementação são funções puras (EM.1.3, decisão D5). Lança se a chave não existe.
export interface EmailRenderer {
  render(templateKey: string, payload: Record<string, unknown>): RenderedEmail
}
