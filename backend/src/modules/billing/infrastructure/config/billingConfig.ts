import type { BillingPrices } from '../../domain/funnel'

// Leitura e validação das variáveis de ambiente de cobrança (MO.2.2). Função pura: recebe o `env`
// e devolve a configuração ou lança com a lista do que está errado, pra o processo cair na subida.
//
// `BILLING_PROVIDER` tem padrão `disabled`: as credenciais do RevenueCat só existem no fim, e sem
// elas o app inteiro tem de continuar funcionando (todo mundo free, webhook fora do ar). Um deploy
// que cobra de verdade diz `revenuecat` de propósito.
export type BillingConfig = RevenueCatBillingConfig | DisabledBillingConfig | DevBillingConfig

export interface DisabledBillingConfig {
  provider: 'disabled'
}

// Só para desenvolvimento (MO.4.1): o app em debug "compra" gravando uma assinatura de teste, sem
// RevenueCat nem loja. Recusado quando o ambiente tem credenciais reais (ver `loadBillingConfig`).
export interface DevBillingConfig {
  provider: 'dev'
}

export interface RevenueCatBillingConfig {
  provider: 'revenuecat'
  // Chave SECRETA da API REST (`sk_...`). Nunca vai pro app nem pro frontend.
  secretKey: string
  // Valor exato do cabeçalho `Authorization` que o RevenueCat envia no webhook (configurado no painel).
  webhookAuthorization: string
  // Identificador do entitlement no painel do RevenueCat.
  entitlementId: string
  apiBaseUrl: string
  requestTimeoutMs: number
}

const DEFAULT_ENTITLEMENT_ID = 'pro'
const DEFAULT_API_BASE_URL = 'https://api.revenuecat.com/v1'
const DEFAULT_TIMEOUT_MS = 10_000

export function loadBillingConfig(env: NodeJS.ProcessEnv): BillingConfig {
  const read = (name: string) => env[name]?.trim() || undefined
  const provider = read('BILLING_PROVIDER') ?? 'disabled'

  if (provider === 'disabled') return { provider: 'disabled' }
  if (provider === 'dev') {
    // A imagem do backend roda com `NODE_ENV=production` até no `docker compose up` local, então
    // NODE_ENV não distingue ambiente (mesma ressalva de `emailConfig.ts`). O que distingue um
    // deploy real é ter credenciais reais: com a chave do RevenueCat ou o e-mail de verdade
    // configurados, a compra falsa é recusada na subida.
    if (read('REVENUECAT_SECRET_KEY') || read('EMAIL_PROVIDER') === 'resend') {
      throw new Error(
        'Configuração de cobrança inválida: BILLING_PROVIDER=dev é só para desenvolvimento e é recusado com REVENUECAT_SECRET_KEY ou EMAIL_PROVIDER=resend',
      )
    }
    return { provider: 'dev' }
  }

  const problems: string[] = []
  if (provider !== 'revenuecat') {
    problems.push('BILLING_PROVIDER deve ser "revenuecat", "disabled" ou "dev"')
  }
  const secretKey = read('REVENUECAT_SECRET_KEY')
  if (!secretKey)
    problems.push('REVENUECAT_SECRET_KEY é obrigatório com BILLING_PROVIDER=revenuecat')
  const webhookAuthorization = read('REVENUECAT_WEBHOOK_AUTH')
  if (!webhookAuthorization) {
    problems.push('REVENUECAT_WEBHOOK_AUTH é obrigatório com BILLING_PROVIDER=revenuecat')
  }

  let requestTimeoutMs = DEFAULT_TIMEOUT_MS
  const rawTimeout = read('REVENUECAT_TIMEOUT_MS')
  if (rawTimeout !== undefined) {
    const parsed = Number(rawTimeout)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      problems.push('REVENUECAT_TIMEOUT_MS deve ser um número positivo')
    } else {
      requestTimeoutMs = parsed
    }
  }

  if (problems.length > 0 || !secretKey || !webhookAuthorization) {
    throw new Error(`Configuração de cobrança inválida: ${problems.join('; ')}`)
  }

  return {
    provider: 'revenuecat',
    secretKey,
    webhookAuthorization,
    entitlementId: read('REVENUECAT_ENTITLEMENT_ID') ?? DEFAULT_ENTITLEMENT_ID,
    apiBaseUrl: (read('REVENUECAT_API_BASE_URL') ?? DEFAULT_API_BASE_URL).replace(/\/+$/, ''),
    requestTimeoutMs,
  }
}

// Preços em centavos, só para estimar a receita recorrente no painel admin (MO.7.1). Opcionais: o
// preço de verdade vive nas lojas e no RevenueCat, nunca em código; sem eles o painel mostra o
// resto e avisa que a receita estimada precisa dos dois valores.
export function loadBillingPrices(env: NodeJS.ProcessEnv): BillingPrices {
  const read = (name: string): number | null => {
    const raw = env[name]?.trim()
    if (!raw) return null
    const parsed = Number(raw)
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error(
        `Configuração de cobrança inválida: ${name} deve ser um inteiro positivo em centavos`,
      )
    }
    return parsed
  }
  return {
    monthlyCents: read('BILLING_PRICE_MONTHLY_CENTS'),
    annualCents: read('BILLING_PRICE_ANNUAL_CENTS'),
  }
}
