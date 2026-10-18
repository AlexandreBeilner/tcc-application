import { eq } from 'drizzle-orm'
import { createDb } from './client'
import { lessons } from './schema'
import { LESSON_SEEDS } from './seedLessons'

// Migração de conteúdo aditiva (LJ.3.2): missões de widget (`goal`) entraram no seed, mas o seed nunca
// sobrescreve uma lição já importada (N.23), então o banco ainda guarda o widget sem missão. Para cada
// widget do seed que tem `goal`, acha o mesmo `id` no banco: se existe sem missão, leva a missão e os
// valores iniciais do seed e preserva todo o resto (inclusive edição do painel); se não existe, insere
// o bloco depois do bloco que o antecede no seed. Idempotente: widget que já tem `goal` não é tocado.
// Reutilizada pela LJ.3.4 (missões das outras trilhas): basta o seed ganhar o `goal`.
// Uso: DATABASE_URL=... npx tsx src/db/applyWidgetGoals.ts

import { applyWidgetGoals } from './widgetGoalsMigration'
import type { Blocks, Phases } from './widgetGoalsMigration'

export { applyWidgetGoals }

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
    const { blocks, changed } = applyWidgetGoals(
      row.blocks as Blocks,
      seed.blocks as { phases?: Phases },
    )
    if (changed === 0) continue
    await db
      .update(lessons)
      .set({ blocks: blocks as typeof row.blocks })
      .where(eq(lessons.id, row.id))
    console.log(`lição ${seed.code}: ${changed} missão(ões) de widget aplicada(s)`)
  }
  process.exit(0)
}

if (process.env.VITEST === undefined) {
  main().catch((err) => {
    console.error('erro ao aplicar missões:', err)
    process.exit(1)
  })
}
