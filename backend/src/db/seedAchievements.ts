import { randomUUID } from 'node:crypto'
import { createDb } from './client'
import { achievementCriteriaType, achievements } from './schema'

interface AchievementSeed {
  name: string
  description: string
  criteriaType: (typeof achievementCriteriaType.enumValues)[number]
  criteriaValue: string
}

// Catálogo mínimo (tarefa 5.2) — 8 conquistas ilustrativas cobrindo os 4
// tipos de critério (spec, tela 7.2). Valores sujeitos à calibração/autoria
// de conteúdo da semana 7/8.1, mesmo precedente de `macroevent.Templates`
// (4.3) e `MISSION_SEEDS` (5.4).
const ACHIEVEMENT_SEEDS: AchievementSeed[] = [
  {
    name: 'Primeira Semana',
    description: 'Mantenha um streak de 7 dias consecutivos.',
    criteriaType: 'streak_days',
    criteriaValue: '7',
  },
  {
    name: 'Fiel',
    description: 'Mantenha um streak de 30 dias consecutivos.',
    criteriaType: 'streak_days',
    criteriaValue: '30',
  },
  {
    name: 'Estudioso',
    description: 'Complete 10 lições da trilha.',
    criteriaType: 'lessons_completed',
    criteriaValue: '10',
  },
  {
    name: 'Formado na Trilha',
    description: 'Complete todas as 33 lições da trilha.',
    criteriaType: 'lessons_completed',
    criteriaValue: '33',
  },
  {
    name: 'Primeiro Patrimônio',
    description: 'Alcance R$ 12.000,00 de patrimônio no Mercado Ao Vivo.',
    criteriaType: 'net_worth',
    criteriaValue: '12000.00',
  },
  {
    name: 'Grande Investidor',
    description: 'Alcance R$ 25.000,00 de patrimônio no Mercado Ao Vivo.',
    criteriaType: 'net_worth',
    criteriaValue: '25000.00',
  },
  {
    name: 'Primeira Operação',
    description: 'Execute sua primeira operação no Mercado Ao Vivo.',
    criteriaType: 'trades_executed',
    criteriaValue: '1',
  },
  {
    name: 'Trader Ativo',
    description: 'Execute 20 operações no Mercado Ao Vivo.',
    criteriaType: 'trades_executed',
    criteriaValue: '20',
  },
]

// Idempotente por nome: DATABASE_URL=... npm run db:seed:achievements
async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('defina DATABASE_URL antes de rodar o seed')
    process.exit(1)
  }

  const db = createDb(databaseUrl)
  const existing = await db.select({ name: achievements.name }).from(achievements)
  const existingNames = new Set(existing.map((row) => row.name))

  for (const seed of ACHIEVEMENT_SEEDS) {
    if (existingNames.has(seed.name)) {
      console.log(`conquista "${seed.name}" já existia — nada a fazer`)
      continue
    }
    await db.insert(achievements).values({ id: randomUUID(), ...seed })
    console.log(`conquista "${seed.name}" criada`)
  }
  process.exit(0)
}

main().catch((err) => {
  console.error('erro ao rodar seed de conquistas:', err)
  process.exit(1)
})
