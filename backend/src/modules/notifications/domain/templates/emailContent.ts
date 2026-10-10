import type { EmailCategory } from '../emailMessage'

// Um e-mail é uma lista de blocos tipados, nunca HTML solto: o layout gera o HTML (escapado) e a
// versão em texto puro a partir da mesma estrutura, então as duas nunca divergem e nenhum
// template consegue injetar marcação.
export type EmailBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'button'; label: string; url: string }
  | { type: 'note'; text: string }

export interface EmailContent {
  subject: string
  // Texto que o cliente de e-mail mostra ao lado do assunto na caixa de entrada.
  preheader: string
  blocks: EmailBlock[]
}

export interface TemplateContext {
  // URL pública do frontend, sem barra final (ex.: `https://app.exemplo.com`).
  appUrl: string
}

export interface EmailTemplate {
  category: EmailCategory
  // Payload de exemplo: alimenta a pré-visualização (`npm run email:preview`) e o teste que
  // renderiza todo template registrado.
  sample: Record<string, unknown>
  build(payload: Record<string, unknown>, context: TemplateContext): EmailContent
}

export class TemplatePayloadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TemplatePayloadError'
  }
}

export function requireString(payload: Record<string, unknown>, field: string): string {
  const value = payload[field]
  if (typeof value !== 'string' || value.length === 0) {
    throw new TemplatePayloadError(`payload sem "${field}" (texto obrigatório)`)
  }
  return value
}

export function optionalString(
  payload: Record<string, unknown>,
  field: string,
): string | undefined {
  const value = payload[field]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}
