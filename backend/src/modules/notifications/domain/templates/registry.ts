import type { EmailContent, EmailTemplate } from './emailContent'
import { optionalString, requireString } from './emailContent'

// Data e hora em Brasília, ex.: "12/10/2026 às 23:00". Valor ausente ou inválido vira `undefined`.
function formatInstant(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('day')}/${get('month')}/${get('year')} às ${get('hour')}:${get('minute')}`
}

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
  // Verificação de e-mail (EM.3.1, E1). Categoria `security`: sem ela a conta nem entra, então
  // não é desligável. `verifyUrl` carrega o token e é apagado do outbox ao fechar a linha.
  email_verification: {
    category: 'security',
    sample: {
      name: 'Ana',
      verifyUrl: 'https://app.exemplo.com/verificar-email#token=exemplo',
      expiresInHours: 24,
    },
    sensitiveFields: ['verifyUrl'],
    build(payload) {
      const name = optionalString(payload, 'name')
      const hours = typeof payload.expiresInHours === 'number' ? payload.expiresInHours : 24
      return {
        subject: 'Confirme seu e-mail',
        preheader: 'Falta só confirmar seu endereço para entrar.',
        blocks: [
          { type: 'heading', text: 'Confirme seu e-mail' },
          {
            type: 'paragraph',
            text: `${name ? `Olá, ${name}. ` : ''}Para começar a usar a plataforma, confirme que este endereço é seu usando o botão abaixo.`,
          },
          { type: 'button', label: 'Confirmar e-mail', url: requireString(payload, 'verifyUrl') },
          {
            type: 'note',
            text: `O link vale por ${hours} horas e só pode ser usado uma vez. Se você não criou uma conta, ignore este e-mail.`,
          },
        ],
      }
    },
  },
  // Aviso de senha alterada (EM.2.1, E4). Sem link com token: só orienta a quem não reconhece.
  // `sessionsEnded` é verdadeiro no reset (que derruba as outras sessões) e falso na troca feita
  // por quem está logado.
  password_changed: {
    category: 'security',
    sample: { name: 'Ana', sessionsEnded: true },
    build(payload, { appUrl }) {
      const name = optionalString(payload, 'name')
      const sessionsEnded = payload.sessionsEnded === true
      return {
        subject: 'Sua senha foi alterada',
        preheader: 'Se não foi você, redefina a senha agora.',
        blocks: [
          { type: 'heading', text: 'Sua senha foi alterada' },
          {
            type: 'paragraph',
            text: `${name ? `Olá, ${name}. ` : ''}A senha da sua conta acabou de ser alterada${sessionsEnded ? ' e as sessões abertas em outros aparelhos foram encerradas' : ''}.`,
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
  // Aviso de "forçar logout" feito pelo administrador (EM.4.1, E4). Não revela quem nem por quê
  // (o motivo é interno): só diz que as sessões acabaram e como proteger a conta.
  sessions_ended: {
    category: 'security',
    sample: { name: 'Ana' },
    build(payload, { appUrl }) {
      const name = optionalString(payload, 'name')
      return {
        subject: 'Suas sessões foram encerradas',
        preheader: 'Entre de novo para continuar. Se não reconhece, troque a senha.',
        blocks: [
          { type: 'heading', text: 'Suas sessões foram encerradas' },
          {
            type: 'paragraph',
            text: `${name ? `Olá, ${name}. ` : ''}A equipe da plataforma encerrou as sessões abertas da sua conta. Você precisa entrar de novo para continuar.`,
          },
          {
            type: 'paragraph',
            text: 'Seus dados e seu progresso continuam como estavam. Se você não reconhece essa situação, peça uma nova senha pela tela de entrada.',
          },
          { type: 'button', label: 'Ir para a tela de entrada', url: `${appUrl}/login` },
        ],
      }
    },
  },
  // Ciclo de vida da conta (EM.5.1). Nenhum leva link com token; os botões só apontam para telas
  // públicas ou para a trilha. "Como contestar" é responder ao e-mail (`EMAIL_REPLY_TO`).
  welcome: {
    category: 'transactional',
    sample: { name: 'Ana' },
    build(payload, { appUrl }) {
      const name = optionalString(payload, 'name')
      return {
        subject: 'Bem-vindo à plataforma',
        preheader: 'Seu e-mail foi confirmado. O primeiro passo da trilha te espera.',
        blocks: [
          { type: 'heading', text: 'Seu e-mail foi confirmado' },
          {
            type: 'paragraph',
            text: `${name ? `Olá, ${name}. ` : ''}Sua conta está pronta. Você começa com R$ 10.000,00 simulados para investir sem risco e aprende pela trilha de lições.`,
          },
          {
            type: 'paragraph',
            text: 'O melhor jeito de começar é a primeira lição da trilha: leva poucos minutos.',
          },
          { type: 'button', label: 'Começar a trilha', url: `${appUrl}/trilha` },
        ],
      }
    },
  },
  account_suspended: {
    category: 'security',
    sample: { name: 'Ana', reason: 'Mensagens repetidas no feed social.' },
    build(payload) {
      const name = optionalString(payload, 'name')
      const reason = requireString(payload, 'reason')
      return {
        subject: 'Sua conta foi suspensa',
        preheader: 'Veja o motivo e como contestar.',
        blocks: [
          { type: 'heading', text: 'Sua conta foi suspensa' },
          {
            type: 'paragraph',
            text: `${name ? `Olá, ${name}. ` : ''}A equipe da plataforma suspendeu o acesso à sua conta. As sessões abertas foram encerradas e você não consegue entrar por enquanto.`,
          },
          { type: 'paragraph', text: `Motivo registrado: ${reason}` },
          {
            type: 'paragraph',
            text: 'Seu progresso, suas conquistas e sua carteira continuam guardados. Se você acha que houve um engano, responda a este e-mail explicando a situação.',
          },
        ],
      }
    },
  },
  account_reactivated: {
    category: 'security',
    sample: { name: 'Ana' },
    build(payload, { appUrl }) {
      const name = optionalString(payload, 'name')
      return {
        subject: 'Sua conta foi reativada',
        preheader: 'Você já pode entrar de novo.',
        blocks: [
          { type: 'heading', text: 'Sua conta foi reativada' },
          {
            type: 'paragraph',
            text: `${name ? `Olá, ${name}. ` : ''}O acesso à sua conta foi restabelecido, com todo o seu progresso como estava. Entre de novo para continuar.`,
          },
          { type: 'button', label: 'Entrar', url: `${appUrl}/login` },
        ],
      }
    },
  },
  // Enviado antes da anonimização, para o endereço real que está prestes a deixar de existir.
  // Sem nome no payload: o outbox não guarda dado pessoal além do endereço de entrega.
  account_deleted: {
    category: 'security',
    sample: {},
    build() {
      return {
        subject: 'Sua conta foi excluída',
        preheader: 'Confirmação do pedido de exclusão.',
        blocks: [
          { type: 'heading', text: 'Sua conta foi excluída' },
          {
            type: 'paragraph',
            text: 'Confirmamos a exclusão da sua conta. Nome, e-mail, nome de usuário, foto e logins externos foram removidos e as sessões abertas, encerradas.',
          },
          {
            type: 'paragraph',
            text: 'O histórico simulado de operações fica sem identificação, sem ligação com você. Este é o último e-mail que enviamos a este endereço sobre a conta.',
          },
          {
            type: 'note',
            text: 'Se você não pediu a exclusão, responda a este e-mail o quanto antes.',
          },
        ],
      }
    },
  },
  data_exported: {
    category: 'transactional',
    sample: { name: 'Ana' },
    build(payload) {
      const name = optionalString(payload, 'name')
      return {
        subject: 'Você exportou seus dados',
        preheader: 'Aviso de segurança sobre a exportação.',
        blocks: [
          { type: 'heading', text: 'Você exportou seus dados' },
          {
            type: 'paragraph',
            text: `${name ? `Olá, ${name}. ` : ''}Acabamos de gerar uma cópia dos dados da sua conta a pedido de quem estava logado.`,
          },
          {
            type: 'paragraph',
            text: 'Se foi você, não precisa fazer nada. Se não reconhece, troque sua senha e encerre as sessões abertas.',
          },
        ],
      }
    },
  },
  account_adjusted: {
    category: 'transactional',
    sample: { name: 'Ana', summary: 'R$ 50,00 foram creditados no seu caixa.' },
    build(payload, { appUrl }) {
      const name = optionalString(payload, 'name')
      const summary = requireString(payload, 'summary')
      return {
        subject: 'A equipe fez um ajuste na sua conta',
        preheader: summary,
        blocks: [
          { type: 'heading', text: 'Ajuste feito na sua conta' },
          {
            type: 'paragraph',
            text: `${name ? `Olá, ${name}. ` : ''}A equipe da plataforma fez um ajuste na sua conta: ${summary}`,
          },
          { type: 'button', label: 'Ver meu perfil', url: `${appUrl}/perfil` },
          { type: 'note', text: 'Se tiver dúvida sobre o ajuste, responda a este e-mail.' },
        ],
      }
    },
  },
  // Comunicado crítico e aviso de manutenção (EM.5.2, E9). Datas em horário de Brasília.
  announcement: {
    category: 'transactional',
    sample: {
      name: 'Ana',
      title: 'Manutenção programada',
      body: 'O mercado ficará pausado enquanto atualizamos o sistema.',
      kind: 'maintenance',
      startsAt: '2026-10-12T02:00:00.000Z',
      endsAt: '2026-10-12T04:00:00.000Z',
    },
    build(payload, { appUrl }) {
      const name = optionalString(payload, 'name')
      const title = requireString(payload, 'title').replace(/\s+/g, ' ')
      const body = requireString(payload, 'body')
      const isMaintenance = payload.kind === 'maintenance'
      const startsAt = formatInstant(payload.startsAt)
      const endsAt = formatInstant(payload.endsAt)
      const blocks: EmailContent['blocks'] = [
        { type: 'heading', text: title },
        { type: 'paragraph', text: `${name ? `Olá, ${name}. ` : ''}${body}` },
      ]
      if (isMaintenance && startsAt) {
        blocks.push({
          type: 'paragraph',
          text: endsAt
            ? `Quando: de ${startsAt} até ${endsAt} (horário de Brasília).`
            : `Quando: a partir de ${startsAt} (horário de Brasília).`,
        })
      }
      blocks.push({ type: 'button', label: 'Abrir a plataforma', url: appUrl })
      return {
        subject: isMaintenance ? `Manutenção: ${title}` : title,
        preheader: body.slice(0, 120),
        blocks,
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
