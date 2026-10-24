import type { EmailContent, EmailTemplate } from './emailContent'
import { optionalString, requireString, TemplatePayloadError } from './emailContent'

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

// Rentabilidade percentual com sinal, em pt-BR (ex.: "+3,2%", "-1,0%"). Nunca valor absoluto de
// patrimônio (RNF09): o e-mail social só carrega username, nível e esse percentual.
function formatSignedPct(value: number): string {
  const formatted = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  }).format(value)
  return `${formatted}%`
}

// "alice está no nível 12 e teve rentabilidade de +3,2% na semana." (partes que faltarem saem).
function friendStatsSentence(
  payload: Record<string, unknown>,
  username: string,
): string | undefined {
  const level = typeof payload.level === 'number' ? payload.level : undefined
  const returnPct = typeof payload.returnPct === 'number' ? payload.returnPct : undefined
  if (level === undefined && returnPct === undefined) return undefined
  const parts: string[] = []
  if (level !== undefined) parts.push(`está no nível ${level}`)
  if (returnPct !== undefined) {
    parts.push(`teve rentabilidade de ${formatSignedPct(returnPct)} na semana`)
  }
  return `${username} ${parts.join(' e ')}.`
}

const MONTH_NAMES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

// "2026-10" vira "outubro de 2026" (mês do calendário simulado).
function formatMonthKey(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value)
  if (!match) return undefined
  return `${MONTH_NAMES[Number(match[2]) - 1]} de ${match[1]}`
}

function formatBrl(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(value)
    .replace(/\u00a0/g, ' ')
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
  // Pedido de amizade recebido (EM.6.2, E8). Categoria `social`: só sai para quem ligou. O corpo
  // leva apenas username, nível e rentabilidade percentual de quem pediu (RNF09), nunca patrimônio.
  friend_request_received: {
    category: 'social',
    sample: { name: 'Ana', friendUsername: 'bia_invest', level: 12, returnPct: 3.2 },
    build(payload, { appUrl }) {
      const name = optionalString(payload, 'name')
      const friend = requireString(payload, 'friendUsername')
      const stats = friendStatsSentence(payload, friend)
      return {
        subject: `${friend} enviou um pedido de amizade`,
        preheader: 'Aceite para acompanhar o ranking juntos.',
        blocks: [
          { type: 'heading', text: 'Você recebeu um pedido de amizade' },
          {
            type: 'paragraph',
            text: `${name ? `Olá, ${name}. ` : ''}${friend} quer ser seu amigo na plataforma. Amigos aparecem no ranking um do outro, sem mostrar o valor do patrimônio de ninguém.`,
          },
          ...(stats ? [{ type: 'paragraph' as const, text: stats }] : []),
          { type: 'button', label: 'Ver o pedido', url: `${appUrl}/amigos/solicitacoes` },
        ],
      }
    },
  },
  // Pedido de amizade aceito (EM.6.2, E8). Mesmas regras do anterior.
  friend_request_accepted: {
    category: 'social',
    sample: { name: 'Ana', friendUsername: 'bia_invest', level: 12, returnPct: -1.4 },
    build(payload, { appUrl }) {
      const name = optionalString(payload, 'name')
      const friend = requireString(payload, 'friendUsername')
      const stats = friendStatsSentence(payload, friend)
      return {
        subject: `${friend} aceitou seu pedido de amizade`,
        preheader: 'Agora vocês se acompanham no ranking de amigos.',
        blocks: [
          { type: 'heading', text: 'Pedido de amizade aceito' },
          {
            type: 'paragraph',
            text: `${name ? `Olá, ${name}. ` : ''}${friend} aceitou seu pedido. Vocês já aparecem no ranking de amigos um do outro.`,
          },
          ...(stats ? [{ type: 'paragraph' as const, text: stats }] : []),
          { type: 'button', label: 'Ver meus amigos', url: `${appUrl}/amigos` },
        ],
      }
    },
  },
  // Resultado de assembleia de acionistas (MO.6.7). Categoria `social`: só sai para quem ligou.
  // Vai a todo acionista da data de corte, tenha votado ou não, com o mesmo texto: nunca cobra
  // participação. Só o desfecho e o nome da pauta; nunca voto por pessoa nem valor em reais.
  assembly_result: {
    category: 'social',
    sample: {
      name: 'Ana',
      assemblyId: '00000000-0000-4000-8000-000000000001',
      companyName: 'Acme',
      title: 'Orçamento de capital',
      outcome: 'approved',
      reason: 'decided',
      winningLabel: 'Expandir',
    },
    build(payload, { appUrl }) {
      const name = optionalString(payload, 'name')
      const company = requireString(payload, 'companyName')
      const title = requireString(payload, 'title')
      const assemblyId = requireString(payload, 'assemblyId')
      const reason = optionalString(payload, 'reason')
      const winning = optionalString(payload, 'winningLabel')
      let result: string
      if (payload.outcome === 'approved') {
        result = `A pauta foi aprovada${winning ? `: ${winning}` : ''}. O efeito passa a valer na empresa em breve.`
      } else if (reason === 'tie') {
        result = 'A votação terminou empatada, então nada muda na empresa.'
      } else {
        result =
          'A assembleia fechou sem decisão, porque não houve o mínimo de votantes. Nada muda na empresa.'
      }
      return {
        subject: `Resultado da assembleia de ${company}`,
        preheader: title,
        blocks: [
          { type: 'heading', text: `Assembleia de ${company} encerrada` },
          {
            type: 'paragraph',
            text: `${name ? `Olá, ${name}. ` : ''}Você tinha ações de ${company} na data de corte da assembleia "${title}".`,
          },
          { type: 'paragraph', text: result },
          { type: 'button', label: 'Ver o resultado', url: `${appUrl}/assembleias/${assemblyId}` },
        ],
      }
    },
  },
  // Resumo semanal (EM.7.1, E12). Categoria `engagement`: só sai para quem ligou. Leva apenas o
  // nível, a rentabilidade percentual da semana (RNF09, nunca patrimônio) e uma missão do dia. O
  // tom é de evolução: rentabilidade negativa não é mostrada como número nem como perda.
  weekly_digest: {
    category: 'engagement',
    sample: {
      name: 'Ana',
      level: 12,
      weeklyReturnPct: 2.4,
      pendingMissions: 2,
      missionTitle: 'Conclua uma lição',
      dailyPlayedDays: 4,
    },
    build(payload, { appUrl }) {
      const name = optionalString(payload, 'name')
      const dailyPlayedDays =
        typeof payload.dailyPlayedDays === 'number' ? payload.dailyPlayedDays : undefined
      const level = typeof payload.level === 'number' ? payload.level : undefined
      const returnPct =
        typeof payload.weeklyReturnPct === 'number' ? payload.weeklyReturnPct : undefined
      const pending = typeof payload.pendingMissions === 'number' ? payload.pendingMissions : 0
      const missionTitle = optionalString(payload, 'missionTitle')

      const blocks: EmailContent['blocks'] = [
        { type: 'heading', text: 'Seu resumo da semana' },
        {
          type: 'paragraph',
          text: `${name ? `Olá, ${name}. ` : ''}${level !== undefined ? `Você está no nível ${level}. ` : ''}Mais uma semana de aprendizado na plataforma.`,
        },
      ]
      if (returnPct !== undefined && returnPct >= 0) {
        blocks.push({
          type: 'paragraph',
          text: `Sua rentabilidade na semana foi de ${formatSignedPct(returnPct)}.`,
        })
      } else if (returnPct !== undefined) {
        blocks.push({
          type: 'paragraph',
          text: 'O mercado se mexeu bastante nesta semana. Vale rever sua carteira com calma e ver o que a trilha tem a ensinar sobre isso.',
        })
      }
      if (pending > 0) {
        const more = pending > 1 ? ` e mais ${pending - 1}` : ''
        blocks.push({
          type: 'paragraph',
          text: missionTitle
            ? `Hoje tem missão esperando: ${missionTitle}${more}.`
            : `Hoje há ${pending} ${pending === 1 ? 'missão esperando' : 'missões esperando'} por você.`,
        })
      }
      // Trecho do Diário (DI.6.2): dias jogados na semana que passou; quem não jogou nenhum recebe
      // um convite. Sem dado do Diário, o trecho não aparece.
      if (dailyPlayedDays !== undefined && dailyPlayedDays > 0) {
        blocks.push({
          type: 'paragraph',
          text: `No Diário, você jogou ${dailyPlayedDays} dos 7 dias da semana.`,
        })
      } else if (dailyPlayedDays === 0) {
        blocks.push({
          type: 'paragraph',
          text: 'O Diário é um jogo de 3 minutos, igual para todos: uma palavra e uma pergunta. Que tal conhecer?',
        })
      }
      blocks.push({ type: 'button', label: 'Abrir a plataforma', url: `${appUrl}/trilha` })
      if (dailyPlayedDays !== undefined) {
        blocks.push({ type: 'button', label: 'Jogar o Diário', url: `${appUrl}/diario` })
      }
      return {
        subject: 'Seu resumo da semana',
        preheader: 'Seu nível, a evolução da semana e a missão de hoje.',
        blocks,
      }
    },
  },
  // Conquista rara desbloqueada (EM.7.2, E14). Categoria `engagement`. Só o nome e a descrição da
  // conquista: quantas pessoas a têm ou quem são nunca entra no e-mail (RNF09 e privacidade).
  rare_achievement: {
    category: 'engagement',
    sample: {
      name: 'Ana',
      achievementName: 'Fiel',
      achievementDescription: '30 dias seguidos de atividade.',
    },
    build(payload, { appUrl }) {
      const name = optionalString(payload, 'name')
      const achievement = requireString(payload, 'achievementName')
      const description = optionalString(payload, 'achievementDescription')
      return {
        subject: `Você desbloqueou a conquista ${achievement}`,
        preheader: 'Poucas pessoas chegaram até aqui.',
        blocks: [
          { type: 'heading', text: 'Conquista rara desbloqueada' },
          {
            type: 'paragraph',
            text: `${name ? `Parabéns, ${name}. ` : 'Parabéns. '}Você desbloqueou a conquista ${achievement}, que poucas pessoas têm.`,
          },
          ...(description ? [{ type: 'paragraph' as const, text: description }] : []),
          { type: 'button', label: 'Ver minhas conquistas', url: `${appUrl}/conquistas` },
        ],
      }
    },
  },
  // Salário simulado creditado (EM.7.2, E11). Categoria `engagement`. O valor é o do próprio
  // destinatário (nunca de outro usuário, RNF09). Depois de um período fora do ar, vários meses
  // são creditados de uma vez e viram um e-mail só.
  salary_credited: {
    category: 'engagement',
    sample: {
      name: 'Ana',
      firstMonth: '2026-10',
      lastMonth: '2026-10',
      months: 1,
      amountPerMonth: 1000,
    },
    build(payload, { appUrl }) {
      const name = optionalString(payload, 'name')
      const amount = typeof payload.amountPerMonth === 'number' ? payload.amountPerMonth : undefined
      if (amount === undefined) {
        throw new TemplatePayloadError('payload sem "amountPerMonth" (número obrigatório)')
      }
      const months = typeof payload.months === 'number' && payload.months > 1 ? payload.months : 1
      const last = formatMonthKey(payload.lastMonth)
      const first = formatMonthKey(payload.firstMonth)
      const greeting = name ? `Olá, ${name}. ` : ''
      const text =
        months === 1
          ? `${greeting}Seu salário simulado${last ? ` de ${last}` : ''} foi creditado: ${formatBrl(amount)} no seu caixa.`
          : `${greeting}Seus salários simulados${first && last ? ` de ${first} a ${last}` : ''} foram creditados: ${months} meses de ${formatBrl(amount)}, ${formatBrl(amount * months)} no total, no seu caixa.`
      return {
        subject:
          months === 1
            ? 'Seu salário simulado foi creditado'
            : 'Seus salários simulados foram creditados',
        preheader: 'Dinheiro novo no caixa, pronto para investir.',
        blocks: [
          { type: 'heading', text: 'Salário creditado' },
          { type: 'paragraph', text },
          {
            type: 'paragraph',
            text: 'O salário cai direto no caixa para você investir como quiser e não conta como rentabilidade no ranking.',
          },
          { type: 'button', label: 'Ver minha carteira', url: appUrl },
        ],
      }
    },
  },
  // Lembrete de sequência (EM.7.3, E13, D9). Categoria `engagement`. É um convite: diz o fato
  // (a sequência segue de pé até a virada do dia) e oferece uma lição rápida, sem pedir pressa,
  // sem culpa e sem falar do que se perde. O dia da sequência termina às 21h de Brasília.
  streak_reminder: {
    category: 'engagement',
    sample: { name: 'Ana', streak: 12 },
    build(payload, { appUrl }) {
      const name = optionalString(payload, 'name')
      const streak = typeof payload.streak === 'number' ? payload.streak : undefined
      if (streak === undefined) {
        throw new TemplatePayloadError('payload sem "streak" (número obrigatório)')
      }
      return {
        subject: `Sua sequência de ${streak} dias segue de pé`,
        preheader: 'Que tal uma lição rápida hoje?',
        blocks: [
          { type: 'heading', text: `Sua sequência de ${streak} dias segue de pé` },
          {
            type: 'paragraph',
            text: `${name ? `Olá, ${name}. ` : ''}Ela segue de pé até as 21h de hoje (horário de Brasília). Quer fazer uma lição rápida?`,
          },
          {
            type: 'paragraph',
            text: 'Ou, se preferir, o Diário de hoje leva 3 minutos e mantém sua sequência.',
          },
          { type: 'button', label: 'Fazer uma lição', url: `${appUrl}/trilha` },
          { type: 'button', label: 'Jogar o Diário', url: `${appUrl}/diario` },
        ],
      }
    },
  },
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
