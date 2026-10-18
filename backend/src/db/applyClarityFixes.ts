import { eq } from 'drizzle-orm'
import { createDb } from './client'
import { lessons } from './schema'
import { applyClarityFixes, type Blocks } from './clarityFixesMigration'

// Migração de conteúdo aditiva (2026-10-18): leva às lições já importadas os textos mais claros de
// perguntas de estimativa e de missões de widget (tabela em `clarityFixesMigration.ts`). Idempotente e só
// troca o que encontra exatamente como esperado: texto editado pelo painel fica como está.
// Rode depois dos demais `apply*`. Uso: DATABASE_URL=... npx tsx src/db/applyClarityFixes.ts

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('defina DATABASE_URL antes de rodar')
    process.exit(1)
  }
  const db = createDb(databaseUrl)
  for (const row of await db.select().from(lessons)) {
    if (!row.blocks) continue
    const { blocks, changes } = applyClarityFixes(row.blocks as Blocks)
    if (changes === 0) continue
    await db
      .update(lessons)
      .set({ blocks: blocks as typeof row.blocks })
      .where(eq(lessons.id, row.id))
    console.log(`lição ${row.stableKey}: ${changes} mudança(s)`)
  }
  process.exit(0)
}

if (process.env.VITEST === undefined) {
  main().catch((err) => {
    console.error('erro ao aplicar ajustes de clareza:', err)
    process.exit(1)
  })
}
