import { randomUUID } from 'node:crypto'
import { createDb } from './client'
import { lessons } from './schema'

interface LessonSeed {
  code: string
  trackNumber: number
  trackName: string
  sortOrder: number
  title: string
  centralConcept: string
  unlocksDescription: string | null
}

// Seed mínimo (tarefa 5.6) — só o bastante pra exercitar a cadeia de
// desbloqueio entre trilhas ponta a ponta (0.5 → 1.1), não o currículo
// completo (33 lições — autoria é semana 7). Conteúdo real da spec seção
// 5.1, não placeholder.
const LESSON_SEEDS: LessonSeed[] = [
  {
    code: '0.1',
    trackNumber: 0,
    trackName: 'Trilha 0 — Fundamentos',
    sortOrder: 1,
    title: 'O que é investir',
    centralConcept: 'Investir vs poupar; capital trabalhando para você',
    unlocksDescription: 'Acesso ao Portfólio',
  },
  {
    code: '0.2',
    trackNumber: 0,
    trackName: 'Trilha 0 — Fundamentos',
    sortOrder: 2,
    title: 'Juros simples vs compostos',
    centralConcept: 'Crescimento linear vs exponencial (TCC cap. 2.1.1)',
    unlocksDescription: 'Calculadora Financeira',
  },
  {
    code: '0.3',
    trackNumber: 0,
    trackName: 'Trilha 0 — Fundamentos',
    sortOrder: 3,
    title: 'Inflação e poder de compra',
    centralConcept: 'Por que R$100 hoje ≠ R$100 amanhã',
    unlocksDescription: null,
  },
  {
    code: '0.4',
    trackNumber: 0,
    trackName: 'Trilha 0 — Fundamentos',
    sortOrder: 4,
    title: 'Rendimento nominal vs real',
    centralConcept: 'Descontar a inflação do retorno',
    unlocksDescription: null,
  },
  {
    code: '0.5',
    trackNumber: 0,
    trackName: 'Trilha 0 — Fundamentos',
    sortOrder: 5,
    title: 'Por que a poupança geralmente perde',
    centralConcept: 'Comparação direta poupança vs Selic/CDI',
    unlocksDescription: 'Acesso à Trilha 1 (Renda Fixa)',
  },
  {
    code: '1.1',
    trackNumber: 1,
    trackName: 'Trilha 1 — Renda Fixa',
    sortOrder: 6,
    title: 'O que é renda fixa',
    centralConcept: 'Emprestar dinheiro a um emissor',
    unlocksDescription: 'Tesouro Selic',
  },
]

// Idempotente: DATABASE_URL=... npm run db:seed:lessons
async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('defina DATABASE_URL antes de rodar o seed')
    process.exit(1)
  }

  const db = createDb(databaseUrl)
  for (const seed of LESSON_SEEDS) {
    const [row] = await db
      .insert(lessons)
      .values({ id: randomUUID(), ...seed })
      .onConflictDoNothing({ target: lessons.code })
      .returning()
    console.log(row ? `lição ${seed.code} criada` : `lição ${seed.code} já existia — nada a fazer`)
  }
  process.exit(0)
}

main().catch((err) => {
  console.error('erro ao rodar seed de lições:', err)
  process.exit(1)
})
