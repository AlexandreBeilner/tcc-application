import { randomUUID } from 'node:crypto'
import { REVIEW_OLD_LESSON_MISSION_KEY } from '../modules/missions/domain/mission'
import { createDb } from './client'
import { dailyMissions } from './schema'

interface MissionSeed {
  key: string
  title: string
  description: string
  completionCriteria: string
  xpReward: number
  requiresLessonCompletion: boolean
}

// Catálogo mínimo (tarefa 5.4) — as 3 missões de exemplo da spec 6.1.
// `xpReward` flat e ilustrativo (sujeito à calibração da tarefa 8.1), mesmo
// tratamento de `LESSON_XP_REWARD` (5.6). `key` (tarefa 6.6.4) é o
// identificador estável que código cliente usa pra achar uma missão
// específica — `title` pode mudar (correção de texto, tradução) sem quebrar
// esse casamento.
const MISSION_SEEDS: MissionSeed[] = [
  {
    key: 'lesson_complete',
    title: 'Complete uma lição da trilha',
    description: 'Avance em qualquer lição da sua trilha de aprendizagem hoje.',
    completionCriteria: 'Concluir o step de desbloqueio de qualquer lição no dia',
    xpReward: 30,
    requiresLessonCompletion: true,
  },
  {
    key: 'calculator_compare',
    title: 'Compare dois produtos de renda fixa na calculadora',
    description: 'Use a calculadora financeira pra comparar dois produtos de renda fixa.',
    completionCriteria: 'Reportado pelo cliente — sem verificação cruzada nesta fase',
    xpReward: 30,
    requiresLessonCompletion: false,
  },
  {
    key: 'feed_read',
    title: 'Consulte o feed de notícias',
    description: 'Abra o feed de notícias de mercado e leia pelo menos um evento.',
    completionCriteria: 'Reportado pelo cliente — sem verificação cruzada nesta fase',
    xpReward: 30,
    requiresLessonCompletion: false,
  },
  // Segunda missão com verificação cruzada real (backlog engajamento H.2),
  // dispatchada por `key` em `CompleteMissionUseCase` em vez de uma coluna
  // dedicada como `requiresLessonCompletion` acima — só esta precisa dela
  // nesta fase. Nunca penaliza: some da lista de missões do dia se não for
  // feita, sem tirar xp nem estragar streak (mesmo tratamento de qualquer
  // missão não concluída). Sempre visível mesmo pra quem não tem nenhuma
  // lição elegível ainda — mesmo padrão das 3 acima (ex: `calculator_compare`
  // aparece antes da calculadora ser desbloqueada).
  {
    key: REVIEW_OLD_LESSON_MISSION_KEY,
    title: 'Revise uma lição concluída há mais de 14 dias',
    description: 'Reabra e revise uma lição da sua trilha que você concluiu há mais de 2 semanas.',
    completionCriteria: 'Reabrir e revisar hoje uma lição com completedAt mais antigo que 14 dias',
    xpReward: 30,
    requiresLessonCompletion: false,
  },
]

// Idempotente por key: DATABASE_URL=... npm run db:seed:missions
async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('defina DATABASE_URL antes de rodar o seed')
    process.exit(1)
  }

  const db = createDb(databaseUrl)
  const existing = await db.select({ key: dailyMissions.key }).from(dailyMissions)
  const existingKeys = new Set(existing.map((row) => row.key))

  for (const seed of MISSION_SEEDS) {
    if (existingKeys.has(seed.key)) {
      console.log(`missão "${seed.key}" já existia — nada a fazer`)
      continue
    }
    await db.insert(dailyMissions).values({ id: randomUUID(), ...seed })
    console.log(`missão "${seed.key}" criada`)
  }
  process.exit(0)
}

main().catch((err) => {
  console.error('erro ao rodar seed de missões:', err)
  process.exit(1)
})
