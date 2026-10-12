import { randomUUID } from 'node:crypto'
import { createDb } from './client'
import { achievementCriteriaType, achievements } from './schema'
import { loadAssemblyConfig } from '../modules/assemblies/infrastructure/config/assemblyConfig'

export interface AchievementSeed {
  // Chave estável (N.19): o painel pode renomear a conquista, então o seed não casa por nome.
  seedKey: string
  name: string
  description: string
  criteriaType: (typeof achievementCriteriaType.enumValues)[number]
  criteriaValue: string
  // Rara de verdade (ponto 044): ponto de partida editável no painel; quem decide é o catálogo.
  isRare?: boolean
}

// Catálogo mínimo (tarefa 5.2) — 8 conquistas ilustrativas cobrindo os 4
// tipos de critério (spec, tela 7.2). Valores sujeitos à calibração/autoria
// de conteúdo da semana 7/8.1, mesmo precedente de `macroevent.Templates`
// (4.3) e `MISSION_SEEDS` (5.4).
export const ACHIEVEMENT_SEEDS: AchievementSeed[] = [
  {
    seedKey: 'streak_7',
    name: 'Primeira Semana',
    description: 'Mantenha um streak de 7 dias consecutivos.',
    criteriaType: 'streak_days',
    criteriaValue: '7',
  },
  {
    seedKey: 'streak_30',
    name: 'Fiel',
    description: 'Mantenha um streak de 30 dias consecutivos.',
    criteriaType: 'streak_days',
    criteriaValue: '30',
    isRare: true,
  },
  {
    seedKey: 'lessons_10',
    name: 'Estudioso',
    description: 'Complete 10 lições da trilha.',
    criteriaType: 'lessons_completed',
    criteriaValue: '10',
  },
  {
    seedKey: 'lessons_35',
    name: 'Formado na Trilha',
    // 35 desde a tarefa M.5 (backlog-motor-mercado-realista) — Trilha 1
    // ganhou 2 lições novas (33→35 no currículo, spec 5.1). Seed só insere
    // (nunca atualiza por nome), então um ambiente que já tinha esta
    // conquista com `criteriaValue = '33'` não é corrigido por rodar o seed
    // de novo — precisa de um update manual nessa linha.
    description: 'Complete todas as 35 lições da trilha.',
    criteriaType: 'lessons_completed',
    criteriaValue: '35',
    isRare: true,
  },
  {
    seedKey: 'net_worth_12k',
    name: 'Primeiro Patrimônio',
    description: 'Alcance R$ 12.000,00 de patrimônio no Mercado Ao Vivo.',
    criteriaType: 'net_worth',
    criteriaValue: '12000.00',
  },
  {
    seedKey: 'net_worth_25k',
    name: 'Grande Investidor',
    description: 'Alcance R$ 25.000,00 de patrimônio no Mercado Ao Vivo.',
    criteriaType: 'net_worth',
    criteriaValue: '25000.00',
    isRare: true,
  },
  {
    seedKey: 'trades_1',
    name: 'Primeira Operação',
    description: 'Execute sua primeira operação no Mercado Ao Vivo.',
    criteriaType: 'trades_executed',
    criteriaValue: '1',
  },
  {
    seedKey: 'trades_20',
    name: 'Trader Ativo',
    description: 'Execute 20 operações no Mercado Ao Vivo.',
    criteriaType: 'trades_executed',
    criteriaValue: '20',
  },
  // Critérios de qualidade (backlog engajamento H.1), não só volume.
  {
    seedKey: 'micro_decisions_streak_5',
    name: 'Olho Clínico',
    description: 'Acerte 5 apostas de Micro-decisão seguidas.',
    criteriaType: 'micro_decisions_streak',
    criteriaValue: '5',
  },
  {
    seedKey: 'track_completed_no_errors',
    name: 'Trilha Impecável',
    description: 'Complete uma trilha inteira sem nenhum erro na aposta.',
    criteriaType: 'track_completed_no_errors',
    criteriaValue: '1',
    isRare: true,
  },
  {
    seedKey: 'lesson_reviewed',
    name: 'Voltou pra Revisar',
    description: 'Revise voluntariamente uma lição já concluída.',
    criteriaType: 'lesson_reviewed',
    criteriaValue: '1',
  },
  // Participação (MO.6.7): só por votar, nunca por estar do lado vencedor.
  {
    seedKey: 'assemblies_participated_3',
    name: 'Acionista Ativo',
    description: 'Vote em 3 assembleias de acionistas.',
    criteriaType: 'assemblies_participated',
    criteriaValue: '3',
  },
  // Indicação (MO.7.2): amigos que concluíram a primeira lição. Os marcos 5, 20 e 50 espelham a
  // escada de `referral_milestones`.
  {
    seedKey: 'referrals_qualified_5',
    name: 'Convidou os Primeiros',
    description: 'Traga 5 amigos que concluíram a primeira lição.',
    criteriaType: 'referrals_qualified',
    criteriaValue: '5',
  },
  {
    seedKey: 'referrals_qualified_20',
    name: 'Comunidade em Crescimento',
    description: 'Traga 20 amigos que concluíram a primeira lição.',
    criteriaType: 'referrals_qualified',
    criteriaValue: '20',
    isRare: true,
  },
  {
    seedKey: 'referrals_qualified_50',
    name: 'Fundador de Turma',
    description: 'Traga 50 amigos que concluíram a primeira lição.',
    criteriaType: 'referrals_qualified',
    criteriaValue: '50',
    isRare: true,
  },
]

// Idempotente por seedKey (N.19), só insere: nunca atualiza uma conquista que o painel
// editou, e renomear no painel não gera duplicata na próxima execução. Ambiente antigo
// já tem seed_key preenchida pela migration 0021.
// DATABASE_URL=... npm run db:seed:achievements
async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('defina DATABASE_URL antes de rodar o seed')
    process.exit(1)
  }

  const db = createDb(databaseUrl)
  const existing = await db.select({ seedKey: achievements.seedKey }).from(achievements)
  const existingKeys = new Set(existing.map((row) => row.seedKey))

  // A conquista de assembleia só nasce com o recurso ligado (padrão): desligado, ninguém a alcança.
  const assembliesOn = loadAssemblyConfig(process.env).enabled
  for (const seed of ACHIEVEMENT_SEEDS) {
    if (seed.criteriaType === 'assemblies_participated' && !assembliesOn) continue
    if (existingKeys.has(seed.seedKey)) {
      console.log(`conquista "${seed.name}" já existia — nada a fazer`)
      continue
    }
    await db.insert(achievements).values({ id: randomUUID(), ...seed })
    console.log(`conquista "${seed.name}" criada`)
  }
  process.exit(0)
}

if (process.env.VITEST === undefined) {
  main().catch((err) => {
    console.error('erro ao rodar seed de conquistas:', err)
    process.exit(1)
  })
}
