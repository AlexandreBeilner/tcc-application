import cors from 'cors'
import type { RequestHandler } from 'express'

// Rotas públicas do jogo: as que a página da landing (`selucra.com.br/diario`) chama sem login.
// `/daily/today`, `/daily/:number` e as duas de resposta. `/daily/:number/me` e `/daily/me/stats`
// são do usuário logado e continuam só com a origem do app.
const PUBLIC_DAILY_PATH = /^\/daily\/(?:today|\d+|\d+\/word\/guess|\d+\/cards\/[a-z]+\/answer)\/?$/

export function isPublicDailyPath(path: string): boolean {
  return PUBLIC_DAILY_PATH.test(path)
}

export interface ApiCorsOptions {
  appOrigin: string
  landingOrigin: string
}

// CORS da API: só a origem do app, exceto nas rotas públicas do Diário, que aceitam também a da
// landing. Nunca com credenciais (a landing não manda cookie nem token) e nunca `*`.
export function createApiCors(options: ApiCorsOptions): RequestHandler {
  const appOnly = cors({ origin: options.appOrigin })
  const withLanding = cors({ origin: [options.appOrigin, options.landingOrigin] })
  return (req, res, next) => (isPublicDailyPath(req.path) ? withLanding : appOnly)(req, res, next)
}
