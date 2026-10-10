import type { EmailTemplate } from './emailContent'
import { optionalString } from './emailContent'

// Catálogo de templates. Cada tarefa que envia um e-mail novo registra o dela aqui, com a
// categoria (decide se é opcional, EM.6.1) e um payload de exemplo.
export const EMAIL_TEMPLATES: Record<string, EmailTemplate> = {
  // Usado pelo `npm run email:test` e pela pré-visualização: confere remetente, domínio e a
  // aparência do layout sem depender de nenhum fluxo de negócio.
  system_test: {
    category: 'transactional',
    sample: { name: 'Ana' },
    build(payload, { appUrl }) {
      const name = optionalString(payload, 'name')
      return {
        subject: 'Teste do gateway de e-mail',
        preheader: 'Se você leu isto, o envio está funcionando.',
        blocks: [
          { type: 'heading', text: 'Teste de e-mail' },
          {
            type: 'paragraph',
            text: `${name ? `Olá, ${name}. ` : ''}Se você recebeu esta mensagem, o envio de e-mails da plataforma está funcionando.`,
          },
          { type: 'button', label: 'Abrir a plataforma', url: appUrl },
          { type: 'note', text: 'Esta mensagem foi enviada só para teste. Não precisa responder.' },
        ],
      }
    },
  },
}
