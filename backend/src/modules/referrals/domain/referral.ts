// Regras puras da indicação entre amigos (MO.7.2). Sem banco, HTTP nem relógio.

// Alfabeto sem caracteres ambíguos (0/O, 1/I/L): o código é digitado e lido em voz alta.
export const REFERRAL_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const REFERRAL_CODE_LENGTH = 8
export const REFERRAL_CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/

export function generateReferralCode(randomInt: (maxExclusive: number) => number): string {
  let code = ''
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
    code += REFERRAL_CODE_ALPHABET[randomInt(REFERRAL_CODE_ALPHABET.length)]
  }
  return code
}

// Normaliza o que veio do link ou do campo (caixa e espaços). `null` = formato inválido.
export function parseReferralCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const code = raw.trim().toUpperCase()
  return REFERRAL_CODE_PATTERN.test(code) ? code : null
}
