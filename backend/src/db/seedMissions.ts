import { randomUUID } from 'node:crypto'
import { createDb } from './client'
import { dailyMissions } from './schema'

interface MissionSeed {
  title: string
  description: string
  completionCriteria: string
  xpReward: number
  requiresLessonCompletion: boolean
}

// Catálogo mínimo (tarefa 5.4) — as 3 missões de exemplo da spec 6.1.
// `xpReward` flat e ilustrativo (sujeito à calibração da tarefa 8.1), mesmo
// tratamento de `LESSON_XP_REWARD` (5.6).
const MISSION_SEEDS: MissionSeed[] = [
  {
    title: 'Complete uma lição da trilha',
    description: 'Avance em qualquer lição da sua trilha de aprendizagem hoje.',
    completionCriteria: 'Concluir o step de desbloqueio de qualquer lição no dia',
    xpReward: 30,
    requiresLessonCompletion: true,
  },
  {
    title: 'Compare dois produtos de renda fixa na calculadora',
    description: 'Use a calculadora financeira pra comparar dois produtos de renda fixa.',
    completionCriteria: 'Reportado pelo cliente — sem verificação cruzada nesta fase',
    xpReward: 30,
    requiresLessonCompletion: false,
  },
  {
    title: 'Consulte o feed de notícias',
    description: 'Abra o feed de notícias de mercado e leia pelo menos um evento.',
    completionCriteria: 'Reportado pelo cliente — sem verificação cruzada nesta fase',
    xpReward: 30,
    requiresLessonCompletion: false,
  },
]

// Idempotente por título: DATABASE_URL=... npm run db:seed:missions
async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('defina DATABASE_URL antes de rodar o seed')
    process.exit(1)
  }

  const db = createDb(databaseUrl)
  const existing = await db.select({ title: dailyMissions.title }).from(dailyMissions)
  const existingTitles = new Set(existing.map((row) => row.title))

  for (const seed of MISSION_SEEDS) {
    if (existingTitles.has(seed.title)) {
      console.log(`missão "${seed.title}" já existia — nada a fazer`)
      continue
    }
    await db.insert(dailyMissions).values({ id: randomUUID(), ...seed })
    console.log(`missão "${seed.title}" criada`)
  }
  process.exit(0)
}

main().catch((err) => {
  console.error('erro ao rodar seed de missões:', err)
  process.exit(1)
})
