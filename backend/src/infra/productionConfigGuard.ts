// Guarda de configuração de produção (LW.3.8). Função pura sobre o `env`: com `DEPLOY_ENV=production`
// recusa a subida quando algo ainda aponta para o ambiente de desenvolvimento (segredo público,
// e-mail só no log, cobrança de mentira, URL de localhost). Sem isso, esquecer uma variável deixa o
// sistema "funcionando" com um segredo que está no repositório.
//
// `DEPLOY_ENV` é uma variável própria e não `NODE_ENV`: a imagem Docker roda com `NODE_ENV=production`
// também no `docker compose up` local (mesma razão registrada em `loadEmailConfig` e na MO.4.1), então
// `NODE_ENV` não separa desenvolvimento de produção. Quem diz `production` é o deploy, de propósito.
const DEV_SECRET = 'dev-secret-troque-em-producao'
const MIN_SECRET_LENGTH = 32
const MIN_DB_PASSWORD_LENGTH = 16
const WEAK_DB_PASSWORDS = new Set(['tcc', 'postgres', 'password', 'senha', 'admin', 'root'])

export type DeployEnv = 'development' | 'production'

export function readDeployEnv(env: NodeJS.ProcessEnv): DeployEnv {
  const raw = env.DEPLOY_ENV?.trim()
  if (!raw || raw === 'development') return 'development'
  if (raw === 'production') return 'production'
  // Valor desconhecido (ex: "prod", "Production") não pode cair em desenvolvimento em silêncio:
  // quem escreveu achava que estava ligando a guarda.
  throw new Error(
    `DEPLOY_ENV inválido: "${raw}" (use "production" ou deixe vazio em desenvolvimento)`,
  )
}

// Devolve a lista de problemas (vazia = configuração aceitável para produção).
export function findProductionConfigProblems(env: NodeJS.ProcessEnv): string[] {
  const problems: string[] = []
  const read = (name: string) => env[name]?.trim() || undefined

  checkSecret('JWT_SECRET', read('JWT_SECRET'), true, problems)
  // Sem valor próprio o segredo de cancelar inscrição reaproveita o do JWT (já checado acima).
  checkSecret('EMAIL_UNSUBSCRIBE_SECRET', read('EMAIL_UNSUBSCRIBE_SECRET'), false, problems)

  if (read('EMAIL_PROVIDER') !== 'resend') {
    problems.push('EMAIL_PROVIDER deve ser "resend" em produção ("log" só imprime o e-mail no log)')
  }
  if (read('BILLING_PROVIDER') === 'dev') {
    problems.push('BILLING_PROVIDER=dev grava assinatura de mentira, não vale em produção')
  }

  checkPublicUrl('FRONTEND_URL', read('FRONTEND_URL'), true, problems)
  checkPublicUrl('PUBLIC_API_URL', read('PUBLIC_API_URL'), true, problems)
  // O login Google é opcional; só confere o retorno quando ele está configurado.
  if (read('GOOGLE_CLIENT_ID')) {
    checkPublicUrl('GOOGLE_REDIRECT_URI', read('GOOGLE_REDIRECT_URI'), true, problems)
  }

  checkDatabaseUrl(read('DATABASE_URL'), problems)
  if (!read('REDIS_URL')) problems.push('REDIS_URL é obrigatória em produção')
  if (!read('ENGINE_URL')) problems.push('ENGINE_URL é obrigatória em produção')

  return problems
}

// Chamada no arranque do `server.ts`: em desenvolvimento não faz nada; em produção derruba o
// processo com a lista completa do que está errado.
export function assertProductionConfig(env: NodeJS.ProcessEnv): void {
  if (readDeployEnv(env) !== 'production') return
  const problems = findProductionConfigProblems(env)
  if (problems.length > 0) {
    throw new Error(`configuração inválida para produção: ${problems.join('; ')}`)
  }
}

function checkSecret(
  name: string,
  value: string | undefined,
  required: boolean,
  problems: string[],
) {
  if (value === undefined) {
    if (required) problems.push(`${name} é obrigatório em produção`)
    return
  }
  if (value === DEV_SECRET) {
    problems.push(`${name} está com o valor de desenvolvimento do repositório`)
  } else if (value.length < MIN_SECRET_LENGTH) {
    problems.push(`${name} precisa ter pelo menos ${MIN_SECRET_LENGTH} caracteres`)
  }
}

function checkPublicUrl(
  name: string,
  value: string | undefined,
  required: boolean,
  problems: string[],
) {
  if (value === undefined) {
    if (required) problems.push(`${name} é obrigatória em produção`)
    return
  }
  let url: URL
  try {
    url = new URL(value)
  } catch {
    problems.push(`${name} não é uma URL válida`)
    return
  }
  if (url.protocol !== 'https:') problems.push(`${name} precisa usar https em produção`)
  if (isLocalHost(url.hostname)) problems.push(`${name} aponta para localhost`)
}

function checkDatabaseUrl(value: string | undefined, problems: string[]) {
  if (value === undefined) {
    problems.push('DATABASE_URL é obrigatória em produção')
    return
  }
  let url: URL
  try {
    url = new URL(value)
  } catch {
    problems.push('DATABASE_URL não é uma URL válida')
    return
  }
  const password = decodeURIComponent(url.password)
  if (!password) {
    problems.push('DATABASE_URL sem senha')
  } else if (WEAK_DB_PASSWORDS.has(password.toLowerCase())) {
    problems.push('a senha do banco em DATABASE_URL é uma senha padrão conhecida')
  } else if (password.length < MIN_DB_PASSWORD_LENGTH) {
    problems.push(
      `a senha do banco em DATABASE_URL precisa ter pelo menos ${MIN_DB_PASSWORD_LENGTH} caracteres`,
    )
  }
}

function isLocalHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]'
  )
}
