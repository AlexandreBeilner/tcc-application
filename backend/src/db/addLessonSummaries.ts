import { eq } from 'drizzle-orm'
import { createDb } from './client'
import { lessons } from './schema'
import { LESSON_SEEDS } from './seedLessons'

// Migração de conteúdo única (LJ.1.5): leva para o banco o "O que ficou" de cada lição. O seed
// nunca sobrescreve uma lição já importada (N.23), então o banco ainda não tem `summary`. Só
// preenche onde a lição não tem resumo: resumo editado depois fica como está, e rodar de novo não
// muda nada. Uso: DATABASE_URL=... npx tsx src/db/addLessonSummaries.ts

export function fillSummary(
  current: Record<string, unknown>,
  summary: string[] | undefined,
): { blocks: Record<string, unknown>; filled: boolean } {
  if (!summary || current.summary !== undefined) return { blocks: current, filled: false }
  return { blocks: { ...current, summary }, filled: true }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('defina DATABASE_URL antes de rodar')
    process.exit(1)
  }
  const db = createDb(databaseUrl)
  for (const seed of LESSON_SEEDS) {
    const [row] = await db.select().from(lessons).where(eq(lessons.stableKey, seed.stableKey))
    if (!row?.blocks) continue
    const { blocks, filled } = fillSummary(
      row.blocks as Record<string, unknown>,
      seed.blocks?.summary,
    )
    if (!filled) continue
    await db
      .update(lessons)
      .set({ blocks: blocks as typeof row.blocks })
      .where(eq(lessons.id, row.id))
    console.log(`lição ${seed.code}: resumo preenchido`)
  }
  process.exit(0)
}

if (process.env.VITEST === undefined) {
  main().catch((err) => {
    console.error('erro ao preencher resumos:', err)
    process.exit(1)
  })
}
