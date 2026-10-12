import type { EmailRenderer } from '../../application/ports/emailRenderer'

// Renderiza qualquer chave conhecida de forma previsível; chave desconhecida lança, como o
// renderer real.
export function createFakeEmailRenderer(knownKeys: string[] = ['test']): EmailRenderer {
  return {
    render(templateKey, payload) {
      if (!knownKeys.includes(templateKey)) throw new Error(`template ${templateKey} não existe`)
      return {
        subject: `assunto ${templateKey}`,
        html: `<p>${JSON.stringify(payload)}</p>`,
        text: JSON.stringify(payload),
      }
    },
  }
}
