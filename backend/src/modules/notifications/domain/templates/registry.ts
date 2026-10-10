import type { EmailTemplate } from './emailContent'
import { optionalString, requireString } from './emailContent'

// Catálogo de templates. Cada tarefa que envia um e-mail novo registra o dela aqui, com a
// categoria (decide se é opcional, EM.6.1) e um payload de exemplo.
export const EMAIL_TEMPLATES: Record<string, EmailTemplate> = {
  // Usado pelo `npm run email:test` e pela pré-visualização: confere remetente, domínio e a
  // aparência do layout sem depender de nenhum fluxo de negócio.
  // Recuperação de senha (EM.2.1). O link carrega o token em claro, então `resetUrl` é apagado do
  // outbox quando a linha fecha (`sensitiveFields`).
  password_reset: {
    category: 'security',
    sample: {
      name: 'Ana',
      resetUrl: 'https://app.exemplo.com/redefinir-senha#token=exemplo',
      expiresInMinutes: 30,
    },
    sensitiveFields: ['resetUrl'],
    build(payload) {
      const name = optionalString(payload, 'name')
      const minutes = typeof payload.expiresInMinutes === 'number' ? payload.expiresInMinutes : 30
      return {
        subject: 'Redefinir sua senha',
        preheader: `O link vale por ${minutes} minutos.`,
        blocks: [
          { type: 'heading', text: 'Redefinir sua senha' },
          {
            type: 'paragraph',
            text: `${name ? `Olá, ${name}. ` : ''}Recebemos um pedido para redefinir a senha da sua conta. Use o botão abaixo para escolher uma senha nova.`,
          },
          { type: 'button', label: 'Escolher nova senha', url: requireString(payload, 'resetUrl') },
          {
            type: 'note',
            text: `O link vale por ${minutes} minutos e só pode ser usado uma vez. Se você não pediu a redefinição, ignore este e-mail: sua senha continua a mesma.`,
          },
        ],
      }
    },
  },
  // Aviso de senha alterada (EM.2.1, E4). Sem link com token: só orienta a quem não reconhece.
  password_changed: {
    category: 'security',
    sample: { name: 'Ana' },
    build(payload, { appUrl }) {
      const name = optionalString(payload, 'name')
      return {
        subject: 'Sua senha foi alterada',
        preheader: 'Se não foi você, redefina a senha agora.',
        blocks: [
          { type: 'heading', text: 'Sua senha foi alterada' },
          {
            type: 'paragraph',
            text: `${name ? `Olá, ${name}. ` : ''}A senha da sua conta acabou de ser alterada e as sessões abertas em outros aparelhos foram encerradas.`,
          },
          {
            type: 'paragraph',
            text: 'Se foi você, não precisa fazer nada. Se não reconhece essa alteração, peça uma nova senha agora pela tela de entrada.',
          },
          { type: 'button', label: 'Ir para a tela de entrada', url: `${appUrl}/login` },
        ],
      }
    },
  },
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

export function sensitivePayloadFields(templateKey: string): readonly string[] {
  return EMAIL_TEMPLATES[templateKey]?.sensitiveFields ?? []
}
