import { eq } from 'drizzle-orm'
import { createDb } from './client'
import { lessons } from './schema'
import { LESSON_SEEDS } from './seedLessons'
import { applyMoreBlocks } from './moreBlocksMigration'
import type { Blocks, Phases } from './widgetGoalsMigration'

// Migração de conteúdo aditiva (LJ.5.7): "Saiba mais" entraram no seed, mas o seed nunca sobrescreve uma
// lição já importada (N.23), então o banco ainda tem esses textos e widgets no caminho principal. Para cada
// `more` do seed que o banco não tem, move para ele os blocos que ele guarda (nada é apagado, só muda de
// lugar). Idempotente: `more` já presente não é tocado.
// Uso: DATABASE_URL=... npx tsx src/db/applyMoreBlocks.ts

export { applyMoreBlocks }

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
    const { blocks, moved } = applyMoreBlocks(
      row.blocks as Blocks,
      seed.blocks as { phases?: Phases },
    )
    if (moved === 0) continue
    await db
      .update(lessons)
      .set({ blocks: blocks as typeof row.blocks })
      .where(eq(lessons.id, row.id))
    console.log(`lição ${seed.code}: ${moved} bloco(s) movido(s) para "Saiba mais"`)
  }
  process.exit(0)
}

if (process.env.VITEST === undefined) {
  main().catch((err) => {
    console.error('erro ao aplicar "Saiba mais":', err)
    process.exit(1)
  })
}
