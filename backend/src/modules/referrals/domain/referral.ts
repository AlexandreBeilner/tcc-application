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

export interface Milestone {
  threshold: number
  rewardDays: number
}

// Acima do último marco da escada (dado no banco) a regra continua sozinha: +1 semana a cada 50
// indicações válidas (ponto 052). Sem teto, de propósito.
export const TAIL_EVERY = 50
export const TAIL_REWARD_DAYS = 7

// Todos os marcos já alcançados com `count` indicações válidas, em ordem crescente: os da escada
// e, depois do último, um a cada `TAIL_EVERY`.
export function reachedMilestones(count: number, ladder: readonly Milestone[]): Milestone[] {
  const sorted = [...ladder].sort((a, b) => a.threshold - b.threshold)
  const reached = sorted.filter((m) => m.threshold <= count)
  const last = sorted.length > 0 ? sorted[sorted.length - 1].threshold : 0
  for (let t = last + TAIL_EVERY; t <= count; t += TAIL_EVERY) {
    reached.push({ threshold: t, rewardDays: TAIL_REWARD_DAYS })
  }
  return reached
}

// O próximo marco ainda não alcançado.
export function nextMilestone(count: number, ladder: readonly Milestone[]): Milestone {
  const sorted = [...ladder].sort((a, b) => a.threshold - b.threshold)
  const upcoming = sorted.find((m) => m.threshold > count)
  if (upcoming) return upcoming
  const last = sorted.length > 0 ? sorted[sorted.length - 1].threshold : 0
  const steps = Math.floor((count - last) / TAIL_EVERY) + 1
  return { threshold: last + steps * TAIL_EVERY, rewardDays: TAIL_REWARD_DAYS }
}

const DAY_MS = 86_400_000

// Fim do PRO promocional: a concessão começa onde o acesso atual termina (ou agora, se não é PRO).
export function promoEndFor(now: Date, currentAccessEnd: Date | null, rewardDays: number): Date {
  const base = currentAccessEnd && currentAccessEnd > now ? currentAccessEnd : now
  return new Date(base.getTime() + rewardDays * DAY_MS)
}
