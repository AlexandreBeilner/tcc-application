import { eq } from 'drizzle-orm'
import { createDb } from './client'
import { lessons } from './schema'
import { LESSON_SEEDS } from './seedLessons'
import { applyPollBlocks } from './pollBlocksMigration'
import type { Blocks, Phases } from './widgetGoalsMigration'

// Migração de conteúdo aditiva (LJ.2.6/LJ.2.7): as enquetes entraram no seed, mas o seed nunca sobrescreve uma
// lição já importada (N.23). Para cada enquete do seed que o banco não tem, insere o bloco depois do que a
// antecede. Não remove nada e é idempotente: enquete já presente não é tocada.
// Uso: DATABASE_URL=... npx tsx src/db/applyPollBlocks.ts

export { applyPollBlocks }

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('defina DATABASE_URL antes de rodar')
    process.exit(1)
  }
  const db = createDb(databaseUrl)
  for (const seed of LESSON_SEEDS) {
    if (!seed.blocks) continue
    const [row] = await db.select().from(lessons).where(eq(lessons.stableKey, seed.stableKey))
    if (!row?.blocks) continue
    const { blocks, added } = applyPollBlocks(
      row.blocks as Blocks,
      seed.blocks as { phases?: Phases },
    )
    if (added === 0) continue
    await db
      .update(lessons)
      .set({ blocks: blocks as typeof row.blocks })
      .where(eq(lessons.id, row.id))
    console.log(`lição ${seed.code}: ${added} enquete(s) inserida(s)`)
  }
  process.exit(0)
}

if (process.env.VITEST === undefined) {
  main().catch((err) => {
    console.error('erro ao aplicar enquetes:', err)
    process.exit(1)
  })
}
