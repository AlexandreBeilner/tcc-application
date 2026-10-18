import { eq } from 'drizzle-orm'
import { createDb } from './client'
import { lessons } from './schema'
import { LESSON_SEEDS } from './seedLessons'
import { LESSON_HOOKS } from './lessonHooks'
import { applyLessonHook } from './lessonHooksMigration'
import type { Blocks } from './widgetGoalsMigration'

export { applyLessonHook }

// Migração de conteúdo aditiva (LJ.5.8): os ganchos de abertura entraram no seed, mas o seed nunca
// sobrescreve uma lição já importada (N.23). Troca o primeiro parágrafo antigo pelo novo, só onde o texto
// casa exatamente. Idempotente.
// Uso: DATABASE_URL=... npx tsx src/db/applyLessonHooks.ts

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('defina DATABASE_URL antes de rodar')
    process.exit(1)
  }
  const db = createDb(databaseUrl)
  for (const hook of LESSON_HOOKS) {
    const seed = LESSON_SEEDS.find((s) => s.code === hook.code)
    if (!seed) continue
    const [row] = await db.select().from(lessons).where(eq(lessons.stableKey, seed.stableKey))
    if (!row?.blocks) continue
    const { blocks, changed } = applyLessonHook(row.blocks as Blocks, hook)
    if (changed === 0) continue
    await db
      .update(lessons)
      .set({ blocks: blocks as typeof row.blocks })
      .where(eq(lessons.id, row.id))
    console.log(`lição ${seed.code}: gancho aplicado`)
  }
  process.exit(0)
}

if (process.env.VITEST === undefined) {
  main().catch((err) => {
    console.error('erro ao aplicar ganchos:', err)
    process.exit(1)
  })
}
