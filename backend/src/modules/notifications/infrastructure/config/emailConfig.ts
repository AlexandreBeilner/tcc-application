// Leitura e validação das variáveis de ambiente do e-mail (EM.1.2, plano 4.5). Função pura: recebe
// o `env` e devolve a configuração ou lança com a lista do que está errado, pra o processo cair
// na subida em vez de descobrir na primeira requisição.
//
// `EMAIL_PROVIDER` é obrigatório e explícito. A imagem do backend roda com `NODE_ENV=production`
// também no `docker compose up` local, então `NODE_ENV` não distingue desenvolvimento de
// produção; o `docker-compose.yml` é que fixa `log` como padrão de desenvolvimento, e um deploy
// real precisa dizer `resend` de propósito.
export type EmailConfig = ResendEmailConfig | LogEmailConfig

// Cada fluxo tem remetente e chave próprios: no Resend a chave de envio é restrita a um domínio
// verificado, e a reputação do e-mail de segurança fica separada da do e-mail opcional.
export interface EmailStreamConfig {
  from: string
  apiKey: string
}

interface CommonEmailConfig {
  replyTo?: string
  // Pausa entre envios que respeita o limite de requisições por segundo do provedor.
  delayBetweenSendsMs: number
  outboxIntervalMs: number
  // Cadência com que os jobs de engajamento (resumo semanal, EM.7.x) checam se estão na janela.
  engagementIntervalMs: number
  // Lembrete de sequência em risco (EM.7.3): ligado por padrão (decisão do ponto 045, 2026-10-11);
  // `EMAIL_STREAK_REMINDER=off` desliga.
  streakReminderEnabled: boolean
}

export interface ResendEmailConfig extends CommonEmailConfig {
  provider: 'resend'
  // `transactional` (segurança e transacional, subdomínio send) e `news` (social e engajamento,
  // subdomínio news).
  transactional: EmailStreamConfig
  news: EmailStreamConfig
  // Só usado pelo webhook (EM.1.4); opcional até lá.
  webhookSecret?: string
}

export interface LogEmailConfig extends CommonEmailConfig {
  provider: 'log'
  transactionalFrom: string
  newsFrom: string
}

const DEFAULT_SEND_RPS = 2
const DEFAULT_OUTBOX_INTERVAL_MS = 5_000
const DEFAULT_ENGAGEMENT_INTERVAL_MS = 15 * 60_000
const DEFAULT_LOG_FROM = 'Plataforma <no-reply@localhost>'

export function loadEmailConfig(env: NodeJS.ProcessEnv): EmailConfig {
  const problems: string[] = []
  const read = (name: string) => env[name]?.trim() || undefined

  const provider = read('EMAIL_PROVIDER')
  if (provider !== 'resend' && provider !== 'log') {
    problems.push('EMAIL_PROVIDER é obrigatório e deve ser "resend" ou "log"')
  }

  const sendRps = positiveNumber(env, 'EMAIL_SEND_RPS', DEFAULT_SEND_RPS, problems)
  const outboxIntervalMs = positiveNumber(
    env,
    'EMAIL_OUTBOX_INTERVAL_MS',
    DEFAULT_OUTBOX_INTERVAL_MS,
    problems,
  )

  const engagementIntervalMs = positiveNumber(
    env,
    'EMAIL_ENGAGEMENT_INTERVAL_MS',
    DEFAULT_ENGAGEMENT_INTERVAL_MS,
    problems,
  )

  const common = {
    replyTo: read('EMAIL_REPLY_TO'),
    delayBetweenSendsMs: Math.ceil(1000 / sendRps),
    outboxIntervalMs,
    engagementIntervalMs,
    streakReminderEnabled: read('EMAIL_STREAK_REMINDER')?.toLowerCase() !== 'off',
  }

  if (provider === 'resend') {
    const transactionalKey = read('RESEND_API_KEY_TRANSACTIONAL')
    const newsKey = read('RESEND_API_KEY_NEWS')
    const transactionalFrom = read('EMAIL_FROM_TRANSACTIONAL')
    const newsFrom = read('EMAIL_FROM_NEWS')
    if (!transactionalKey) {
      problems.push('RESEND_API_KEY_TRANSACTIONAL é obrigatória com EMAIL_PROVIDER=resend')
    }
    if (!newsKey) problems.push('RESEND_API_KEY_NEWS é obrigatória com EMAIL_PROVIDER=resend')
    if (!transactionalFrom) {
      problems.push('EMAIL_FROM_TRANSACTIONAL é obrigatório com EMAIL_PROVIDER=resend')
    }
    if (!newsFrom) problems.push('EMAIL_FROM_NEWS é obrigatório com EMAIL_PROVIDER=resend')
    if (transactionalKey && newsKey && transactionalKey === newsKey) {
      problems.push(
        'RESEND_API_KEY_TRANSACTIONAL e RESEND_API_KEY_NEWS não podem ser a mesma chave (cada uma é restrita a um subdomínio)',
      )
    }
    if (problems.length > 0 || !transactionalKey || !newsKey || !transactionalFrom || !newsFrom) {
      throw configError(problems)
    }
    return {
      provider: 'resend',
      transactional: { apiKey: transactionalKey, from: transactionalFrom },
      news: { apiKey: newsKey, from: newsFrom },
      webhookSecret: read('RESEND_WEBHOOK_SECRET'),
      ...common,
    }
  }

  if (problems.length > 0 || provider !== 'log') throw configError(problems)
  return {
    provider: 'log',
    transactionalFrom: read('EMAIL_FROM_TRANSACTIONAL') ?? DEFAULT_LOG_FROM,
    newsFrom: read('EMAIL_FROM_NEWS') ?? DEFAULT_LOG_FROM,
    ...common,
  }
}

function positiveNumber(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  problems: string[],
): number {
  const raw = env[name]?.trim()
  if (!raw) return fallback
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) {
    problems.push(`${name} deve ser um número maior que zero`)
    return fallback
  }
  return value
}

function configError(problems: string[]): Error {
  return new Error(`configuração de e-mail inválida: ${problems.join('; ')}`)
}
