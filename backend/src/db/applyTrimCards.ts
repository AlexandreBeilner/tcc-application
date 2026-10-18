import { eq } from 'drizzle-orm'
import { createDb } from './client'
import { lessons } from './schema'
import { LESSON_SEEDS } from './seedLessons'
import { trimCards } from './trimCardsMigration'
import type { Blocks } from './widgetGoalsMigration'

export { trimCards }

// Migração de conteúdo aditiva (ponto 061, opção d): o seed já não tem o cartão final "Completar esta lição
// libera..." nem os dois cartões curtos da 2.10 em separado, mas nunca sobrescreve lição importada (N.23).
// Tira e funde só o que casa exatamente com o texto antigo (idempotente, preserva edição).
// Uso: DATABASE_URL=... npx tsx src/db/applyTrimCards.ts

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
    const { blocks, changed } = trimCards(row.blocks as Blocks)
    if (changed === 0) continue
    await db
      .update(lessons)
      .set({ blocks: blocks as typeof row.blocks })
      .where(eq(lessons.id, row.id))
    console.log(`lição ${seed.code}: ${changed} ajuste(s) de cartão`)
  }
  process.exit(0)
}

if (process.env.VITEST === undefined) {
  main().catch((err) => {
    console.error('erro ao enxugar cartões:', err)
    process.exit(1)
  })
}
