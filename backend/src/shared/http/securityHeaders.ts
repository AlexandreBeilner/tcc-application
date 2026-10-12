import helmet from 'helmet'
import type { RequestHandler } from 'express'

// Limite explícito do corpo JSON (LW.3.10). É o padrão do Express, escrito aqui pra não depender
// dele; o upload de avatar (multer, 5 MB) e o webhook (raw, 1 MB) têm limites próprios.
export const JSON_BODY_LIMIT = '100kb'

// Cabeçalhos de segurança de uma API JSON (LW.3.10): a resposta nunca é uma página, então a CSP
// é a mais restritiva (nada carrega, nada embute). Duas exceções deliberadas:
// - `Cross-Origin-Resource-Policy: cross-origin`: o frontend (app.selucra.com.br) mostra os
//   avatares servidos em `/avatars` por outra origem (api.selucra.com.br); o padrão do helmet
//   (`same-origin`) os bloquearia no `<img>`.
// - HSTS fica fora: é do proxy de borda (Caddy), que é quem termina o TLS; no HTTP puro do
//   desenvolvimento o cabeçalho não teria efeito.
export function apiSecurityHeaders(): RequestHandler {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    strictTransportSecurity: false,
    referrerPolicy: { policy: 'no-referrer' },
  })
}
