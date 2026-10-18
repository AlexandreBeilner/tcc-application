import { addDays } from '../domain/retention'
import type {
  RetentionDataset,
  SyntheticMilestone,
  SyntheticUser,
} from './fakes/inMemoryRetentionReader'

// PRNG determinístico (mulberry32): o mesmo conjunto de dados em todo teste e em todo computador.
export function seededRandom(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface SyntheticOptions {
  users: number
  // "Hoje" do painel (UTC). Os dados vão até hoje, inclusive.
  today: string
  firstSignupDay: string
  // Primeiro dia com registro de presença e de atividade (podem ser diferentes).
  presenceSince: string
  activitySince: string
  seed?: number
  // Quantos administradores misturar (nunca devem entrar nas contas).
  admins?: number
}

const HOUR = 3_600_000

// Meses de uso de milhares de pessoas: retenção que decai com os dias desde o cadastro, estudo como
// subconjunto da presença, marcos com atrasos variados. Presença só existe a partir de
// `presenceSince` e atividade a partir de `activitySince`, como no banco real.
export function buildSyntheticRetention(options: SyntheticOptions): RetentionDataset {
  const random = seededRandom(options.seed ?? 42)
  const users: SyntheticUser[] = []
  const presence = new Set<string>()
  const activity = new Set<string>()
  const milestones: SyntheticMilestone[] = []

  const span =
    (Date.parse(`${options.today}T00:00:00Z`) - Date.parse(`${options.firstSignupDay}T00:00:00Z`)) /
    86_400_000

  for (let i = 0; i < options.users + (options.admins ?? 0); i++) {
    const isAdmin = i >= options.users
    // Cadastros mais frequentes nos dias recentes (crescimento do produto).
    const dayIndex = Math.floor(Math.pow(random(), 0.6) * (span + 1))
    const signupDay = addDays(options.firstSignupDay, Math.min(dayIndex, span))
    const createdAt = new Date(
      Date.parse(`${signupDay}T00:00:00Z`) + Math.floor(random() * 24 * HOUR),
    )
    const id = `user-${i}`
    users.push({ id, role: isAdmin ? 'admin' : 'user', createdAt })

    const engagement = 0.2 + random() * 0.8
    for (let k = 0; k <= 120; k++) {
      const day = addDays(signupDay, k)
      if (day > options.today) break
      const p = k === 0 ? 1 : engagement * (0.5 * Math.exp(-k / 12) + 0.06)
      if (random() > p) continue
      if (day >= options.presenceSince) presence.add(`${id}|${day}`)
      if (day >= options.activitySince && random() < 0.6) activity.add(`${id}|${day}`)
    }

    if (isAdmin || signupDay < options.presenceSince) continue
    const at = (hours: number) => new Date(createdAt.getTime() + hours * HOUR)
    if (random() < 0.7)
      milestones.push({ userId: id, milestone: 'first_lesson', reachedAt: at(random() * 48) })
    if (random() < 0.3)
      milestones.push({
        userId: id,
        milestone: 'first_trade',
        reachedAt: at(24 + random() * 24 * 20),
      })
    if (random() < 0.12)
      milestones.push({
        userId: id,
        milestone: 'first_fixed_income',
        reachedAt: at(48 + random() * 24 * 25),
      })
    if (random() < 0.2)
      milestones.push({
        userId: id,
        milestone: 'first_daily',
        reachedAt: at(12 + random() * 24 * 15),
      })
  }
  return { users, presence, activity, milestones }
}
