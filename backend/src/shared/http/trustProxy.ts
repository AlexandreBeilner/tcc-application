// Quantos proxies confiáveis ficam entre o usuário e o backend (LW.3.9). Em produção o Caddy é o
// único proxy que o backend enxerga: ele recebe do Cloudflare, descarta o `X-Forwarded-For` que
// veio de fora e grava só o IP real (`CF-Connecting-IP`, aceito só de IPs da Cloudflare). Por isso
// o padrão é 1 (também vale no desenvolvimento, atrás do nginx do gateway). Um número maior só se
// a cadeia ganhar mais uma peça que acrescenta o próprio salto ao `X-Forwarded-For`.
// Número errado é pior que ausente (o limitador de taxa passa a contar o proxy ou um IP forjado),
// então valor inválido derruba a subida em vez de cair no padrão em silêncio.
const DEFAULT_TRUSTED_HOPS = 1
const MAX_TRUSTED_HOPS = 5

export function readTrustedProxyHops(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') return DEFAULT_TRUSTED_HOPS
  const hops = Number(raw)
  if (!Number.isInteger(hops) || hops < 0 || hops > MAX_TRUSTED_HOPS) {
    throw new Error(
      `TRUSTED_PROXY_HOPS inválido ("${raw}"): use um inteiro de 0 a ${MAX_TRUSTED_HOPS}`,
    )
  }
  return hops
}
