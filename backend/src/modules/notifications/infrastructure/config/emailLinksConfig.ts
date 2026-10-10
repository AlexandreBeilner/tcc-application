// Onde moram os links que os e-mails opcionais carregam (EM.6.1) e com qual segredo o token de
// cancelar inscrição é assinado. Função pura sobre o `env`, como `loadEmailConfig`.
export interface EmailLinksConfig {
  // Segredo do HMAC do token de cancelamento. Reserva: o segredo do JWT (a assinatura leva um
  // rótulo de finalidade, então nunca vale como JWT nem o contrário).
  unsubscribeSecret: string
  // URL pública da API (o gateway): o `List-Unsubscribe-Post` precisa de uma URL que aceite POST.
  apiBaseUrl: string
  // URL do frontend: para onde o `GET` do link leva (página de confirmação).
  frontendUrl: string
}

const DEV_SECRET = 'dev-secret-troque-em-producao'

export function loadEmailLinksConfig(env: NodeJS.ProcessEnv): EmailLinksConfig {
  const read = (name: string) => env[name]?.trim() || undefined
  return {
    unsubscribeSecret: read('EMAIL_UNSUBSCRIBE_SECRET') ?? read('JWT_SECRET') ?? DEV_SECRET,
    apiBaseUrl: read('PUBLIC_API_URL') ?? 'http://localhost:8000',
    frontendUrl: read('FRONTEND_URL') ?? 'http://localhost:5173',
  }
}
